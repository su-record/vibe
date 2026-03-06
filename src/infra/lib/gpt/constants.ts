/**
 * GPT API Constants
 * codex-cli + API Key 인증 전용
 */

// 클라이언트 정보 (codex-cli 토큰 갱신용)
export const GPT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

// 토큰 갱신 엔드포인트 (codex-cli refresh용)
export const GPT_TOKEN_URL = 'https://auth.openai.com/oauth/token';

// ChatGPT API 엔드포인트
export const CHATGPT_BASE_URL = 'https://chatgpt.com/backend-api';

// JWT 클레임 경로 (계정 ID 추출용)
export const JWT_CLAIM_PATH = 'https://api.openai.com/auth';
