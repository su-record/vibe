/**
 * Gemini/Antigravity OAuth 상수
 * Antigravity 플러그인에서 추출한 공개 자격 증명
 */

// Google Antigravity OAuth 자격 증명 (공개됨)
export const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
export const ANTIGRAVITY_CLIENT_SECRET = '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';
export const ANTIGRAVITY_REDIRECT_URI = 'http://localhost:51121/oauth-callback';

// OAuth 스코프
export const ANTIGRAVITY_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
];

// API 엔드포인트
export const ANTIGRAVITY_ENDPOINT_DAILY = 'https://daily-cloudcode-pa.sandbox.googleapis.com';
export const ANTIGRAVITY_ENDPOINT_AUTOPUSH = 'https://autopush-cloudcode-pa.sandbox.googleapis.com';
export const ANTIGRAVITY_ENDPOINT_PROD = 'https://cloudcode-pa.googleapis.com';

export const ANTIGRAVITY_ENDPOINTS = [
  ANTIGRAVITY_ENDPOINT_DAILY,
  ANTIGRAVITY_ENDPOINT_AUTOPUSH,
  ANTIGRAVITY_ENDPOINT_PROD,
];

// 기본 프로젝트 ID (필요시)
export const ANTIGRAVITY_DEFAULT_PROJECT_ID = 'rising-fact-p41fc';

// 헤더
export const ANTIGRAVITY_HEADERS = {
  'User-Agent': 'antigravity/1.11.5 darwin/arm64',
  'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
  'Client-Metadata': '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};
