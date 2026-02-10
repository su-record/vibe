/**
 * CLI: vibe google [subcommand]
 *
 * vibe google auth    — OAuth 인증 (브라우저 열기)
 * vibe google status  — 인증 상태 + 승인된 scopes
 * vibe google revoke  — 토큰 삭제
 */

import { execFile } from 'node:child_process';

export async function googleAuth(): Promise<void> {
  try {
    const { googleAuth: auth } = await import('../../tools/google/index.js');
    const result = await auth({ action: 'start' });
    const data = JSON.parse(result.content[0].text);

    if (data.authUrl) {
      console.log('🔐 Google OAuth 인증을 시작합니다.');
      console.log(`\n인증 URL: ${data.authUrl}\n`);
      console.log('브라우저에서 위 URL을 열어 인증을 완료해주세요.');
      openBrowser(data.authUrl);
    } else {
      console.log(result.content[0].text);
    }
  } catch (err) {
    console.error('❌ Google auth failed:', (err as Error).message);
  }
}

export async function googleStatus(): Promise<void> {
  try {
    const { googleAuth: auth } = await import('../../tools/google/index.js');
    const result = await auth({ action: 'status' });
    const data = JSON.parse(result.content[0].text);

    console.log('📋 Google Apps Status');
    console.log(`  Authenticated: ${data.authenticated ? '✅ Yes' : '❌ No'}`);
    if (data.scopes?.length > 0) {
      console.log(`  Scopes: ${data.scopes.length} granted`);
      for (const scope of data.scopes) {
        const short = scope.replace('https://www.googleapis.com/auth/', '');
        console.log(`    - ${short}`);
      }
    }
    if (data.expiresAt) {
      console.log(`  Token expires: ${data.expiresAt}`);
    }
  } catch (err) {
    console.error('❌ Google status failed:', (err as Error).message);
  }
}

export async function googleRevoke(): Promise<void> {
  try {
    const { googleAuth: auth } = await import('../../tools/google/index.js');
    const result = await auth({ action: 'revoke' });
    console.log(JSON.parse(result.content[0].text).message);
  } catch (err) {
    console.error('❌ Google revoke failed:', (err as Error).message);
  }
}

export function googleHelp(): void {
  console.log(`Google Commands:
  vibe google auth      Start Google OAuth authentication
  vibe google status    Check authentication status and scopes
  vibe google revoke    Delete stored tokens
  `);
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], (err) => {
      if (err) console.warn('Could not open browser automatically.');
    });
  } else {
    const cmd = platform === 'darwin' ? 'open' : 'xdg-open';
    execFile(cmd, [url], (err) => {
      if (err) console.warn('Could not open browser automatically.');
    });
  }
}
