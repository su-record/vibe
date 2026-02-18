/**
 * Antigravity / Gemini API 상수
 *
 * Endpoint 우선순위: Production → Autopush → Daily
 * (Pro 계정은 daily sandbox에서 429 발생 → production 우선)
 */

// =============================================
// Antigravity OAuth
// =============================================

export const ANTIGRAVITY_CLIENT_ID =
  '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
export const ANTIGRAVITY_CLIENT_SECRET =
  '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';

export const ANTIGRAVITY_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
];

export const ANTIGRAVITY_REDIRECT_URI = 'http://localhost:51121/oauth-callback';
export const ANTIGRAVITY_REDIRECT_PORT = 51121;

// =============================================
// Gemini CLI OAuth (fallback)
// =============================================

export const GEMINI_CLI_CLIENT_ID =
  '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
export const GEMINI_CLI_CLIENT_SECRET =
  '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';

// =============================================
// API Endpoints — Production 우선 (Pro 계정 429 방지)
// =============================================

export const ENDPOINT_PROD =
  'https://cloudcode-pa.googleapis.com';
export const ENDPOINT_AUTOPUSH =
  'https://autopush-cloudcode-pa.sandbox.googleapis.com';
export const ENDPOINT_DAILY =
  'https://daily-cloudcode-pa.sandbox.googleapis.com';

/** generateContent 호출 시 fallback 순서 (Production 우선) */
export const ENDPOINT_FALLBACKS = [
  ENDPOINT_PROD,
  ENDPOINT_AUTOPUSH,
  ENDPOINT_DAILY,
] as const;

/** loadCodeAssist 호출 시 fallback 순서 (Production 우선) */
export const LOAD_ENDPOINTS = [
  ENDPOINT_PROD,
  ENDPOINT_AUTOPUSH,
  ENDPOINT_DAILY,
] as const;

export const DEFAULT_PROJECT_ID = 'rising-fact-p41fc';

// =============================================
// API Version & Headers
// =============================================

export const API_VERSION = 'v1internal';

export const ANTIGRAVITY_IDE_VERSION = '1.16.5';

export const ANTIGRAVITY_HEADERS: Record<string, string> = {
  'User-Agent': `antigravity/${ANTIGRAVITY_IDE_VERSION} ${process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux'}/${process.arch === 'x64' ? 'amd64' : process.arch}`,
  'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
};

/** loadCodeAssist 요청용 메타데이터 (Antigravity IDE 방식) */
export const ANTIGRAVITY_METADATA = {
  ideName: 'antigravity',
  ideType: 'ANTIGRAVITY',
  ideVersion: ANTIGRAVITY_IDE_VERSION,
};

export const ANTIGRAVITY_SYSTEM_INSTRUCTION = `<identity>
You are a powerful agentic AI coding assistant.
You are pair programming with a USER to solve their coding task.
</identity>

<tool_calling>
Call tools as you normally would. Always use absolute file paths.
</tool_calling>

<communication_style>
- Format responses in github-style markdown
- Be proactive in completing tasks
- Respond like a helpful software engineer
- Ask for clarification when unsure
</communication_style>`;

// =============================================
// Google OAuth URLs
// =============================================

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';

// =============================================
// Retry & Timeout
// =============================================

export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;
