/**
 * Gemini OAuth 인증 (Antigravity 방식)
 * Google OAuth + PKCE를 사용한 Gemini 구독 인증
 */

const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const {
  ANTIGRAVITY_CLIENT_ID,
  ANTIGRAVITY_CLIENT_SECRET,
  ANTIGRAVITY_REDIRECT_URI,
  ANTIGRAVITY_SCOPES,
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} = require('./gemini-constants');

const storage = require('./gemini-storage');

/**
 * PKCE 코드 생성
 */
function generatePKCE() {
  // code_verifier: 43-128자의 랜덤 문자열
  const verifier = crypto.randomBytes(32).toString('base64url');

  // code_challenge: verifier의 SHA256 해시
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');

  return { verifier, challenge };
}

/**
 * OAuth state 인코딩
 */
function encodeState(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * OAuth state 디코딩
 */
function decodeState(state) {
  const normalized = state.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}

/**
 * 토큰 만료 시간 계산
 */
function calculateTokenExpiry(startTime, expiresIn) {
  return startTime + (expiresIn * 1000) - 60000; // 1분 여유
}

/**
 * OAuth 인증 URL 생성
 * @param {string} projectId 프로젝트 ID (선택적)
 * @returns {Object} { url, verifier, projectId }
 */
function createAuthorizationUrl(projectId = '') {
  const pkce = generatePKCE();

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', ANTIGRAVITY_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', ANTIGRAVITY_REDIRECT_URI);
  url.searchParams.set('scope', ANTIGRAVITY_SCOPES.join(' '));
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', encodeState({ verifier: pkce.verifier, projectId: projectId || '' }));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return {
    url: url.toString(),
    verifier: pkce.verifier,
    projectId: projectId || '',
  };
}

/**
 * Authorization code를 토큰으로 교환
 * @param {string} code Authorization code
 * @param {string} state OAuth state
 * @returns {Promise<Object>} 토큰 정보
 */
async function exchangeCodeForTokens(code, state) {
  const { verifier, projectId } = decodeState(state);
  const startTime = Date.now();

  // 토큰 요청
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: ANTIGRAVITY_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`토큰 교환 실패: ${errorText}`);
  }

  const tokenPayload = await tokenResponse.json();

  // 사용자 정보 가져오기
  const userInfoResponse = await fetch(
    'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
    {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    }
  );

  const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : {};

  // 프로젝트 ID 가져오기
  let effectiveProjectId = projectId;
  if (!effectiveProjectId) {
    effectiveProjectId = await fetchProjectId(tokenPayload.access_token);
  }

  return {
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token,
    expires: calculateTokenExpiry(startTime, tokenPayload.expires_in),
    email: userInfo.email,
    projectId: effectiveProjectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
  };
}

/**
 * Antigravity 프로젝트 ID 가져오기
 * @param {string} accessToken 액세스 토큰
 * @returns {Promise<string>} 프로젝트 ID
 */
async function fetchProjectId(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'User-Agent': 'google-api-nodejs-client/9.15.1',
    'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
    'Client-Metadata': ANTIGRAVITY_HEADERS['Client-Metadata'],
  };

  for (const endpoint of ANTIGRAVITY_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          metadata: {
            ideType: 'IDE_UNSPECIFIED',
            platform: 'PLATFORM_UNSPECIFIED',
            pluginType: 'GEMINI',
          },
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (typeof data.cloudaicompanionProject === 'string' && data.cloudaicompanionProject) {
        return data.cloudaicompanionProject;
      }
      if (data.cloudaicompanionProject?.id) {
        return data.cloudaicompanionProject.id;
      }
    } catch (error) {
      // 다음 엔드포인트 시도
    }
  }

  return '';
}

/**
 * 액세스 토큰 갱신
 * @param {string} refreshToken 리프레시 토큰
 * @returns {Promise<Object>} 새 토큰 정보
 */
async function refreshAccessToken(refreshToken) {
  const startTime = Date.now();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`토큰 갱신 실패: ${errorText}`);
  }

  const payload = await response.json();

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expires: calculateTokenExpiry(startTime, payload.expires_in),
  };
}

/**
 * 로컬 서버로 OAuth 콜백 처리
 * @returns {Promise<Object>} 토큰 정보
 */
function startOAuthFlow() {
  return new Promise((resolve, reject) => {
    const auth = createAuthorizationUrl();
    let server;
    let timeoutId;
    let isResolved = false;

    // 안전하게 서버 종료
    const closeServer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        server.close(() => {
          // 서버 완전히 종료 후 프로세스 종료 허용
        });
        server.closeAllConnections && server.closeAllConnections();
      }
    };

    // 콜백 서버 시작
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:51121`);

      if (url.pathname === '/oauth-callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>인증 실패</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>인증 실패</h1>
                <p>오류: ${error}</p>
                <p>이 창을 닫고 다시 시도해주세요.</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error(`OAuth 오류: ${error}`));
          }
          return;
        }

        if (!code || !state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>인증 실패</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>인증 실패</h1>
                <p>필수 파라미터가 없습니다.</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(new Error('필수 파라미터 누락'));
          }
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens(code, state);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>인증 성공</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>인증 성공!</h1>
                <p>${tokens.email}로 로그인되었습니다.</p>
                <p>이 창을 닫아도 됩니다.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </body>
            </html>
          `);

          if (!isResolved) {
            isResolved = true;
            closeServer();
            resolve(tokens);
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>인증 실패</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>인증 실패</h1>
                <p>${err.message}</p>
              </body>
            </html>
          `);
          if (!isResolved) {
            isResolved = true;
            closeServer();
            reject(err);
          }
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Keep-alive 비활성화로 연결 빨리 닫기
    server.keepAliveTimeout = 0;
    server.headersTimeout = 5000;

    server.listen(51121, 'localhost', () => {
      console.log('\n브라우저에서 Google 로그인 페이지가 열립니다...\n');

      // 브라우저 열기
      const open = require('child_process').exec;
      const platform = process.platform;

      if (platform === 'darwin') {
        open(`open "${auth.url}"`);
      } else if (platform === 'win32') {
        open(`start "" "${auth.url}"`);
      } else {
        open(`xdg-open "${auth.url}"`);
      }
    });

    server.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        if (err.code === 'EADDRINUSE') {
          reject(new Error('포트 51121이 이미 사용 중입니다. 다른 인증 프로세스가 실행 중인지 확인하세요.'));
        } else {
          reject(err);
        }
      }
    });

    // 5분 타임아웃
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        closeServer();
        reject(new Error('인증 타임아웃 (5분)'));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * 유효한 액세스 토큰 가져오기 (필요시 갱신)
 * @returns {Promise<Object>} { accessToken, email, projectId }
 */
async function getValidAccessToken() {
  const account = storage.getActiveAccount();

  if (!account) {
    throw new Error('인증된 Gemini 계정이 없습니다. vibe gemini --auth로 로그인하세요.');
  }

  // 토큰이 만료되었으면 갱신
  if (storage.isTokenExpired(account)) {
    console.log('액세스 토큰 갱신 중...');
    const newTokens = await refreshAccessToken(account.refreshToken);
    storage.updateAccessToken(account.email, newTokens.accessToken, newTokens.expires);
    return {
      accessToken: newTokens.accessToken,
      email: account.email,
      projectId: account.projectId,
    };
  }

  return {
    accessToken: account.accessToken,
    email: account.email,
    projectId: account.projectId,
  };
}

module.exports = {
  createAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  startOAuthFlow,
  getValidAccessToken,
  fetchProjectId,
};
