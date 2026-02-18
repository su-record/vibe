/**
 * GPT OAuth Constants
 * OpenAI Codex CLI 인증 방식 (opencode-openai-codex-auth 참고)
 */

// OAuth 클라이언트 정보 (OpenAI Codex CLI)
export const GPT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

// OAuth 엔드포인트
export const GPT_AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
export const GPT_TOKEN_URL = 'https://auth.openai.com/oauth/token';

// 리다이렉트 URI (Codex CLI와 동일한 포트 사용)
export const GPT_REDIRECT_URI = 'http://localhost:1455/auth/callback';

// OAuth 스코프
export const GPT_SCOPE = 'openid profile email offline_access';

// ChatGPT API 엔드포인트
export const CHATGPT_BASE_URL = 'https://chatgpt.com/backend-api';

// JWT 클레임 경로 (계정 ID 추출용)
export const JWT_CLAIM_PATH = 'https://api.openai.com/auth';
