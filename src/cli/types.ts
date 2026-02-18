/**
 * CLI 타입 정의
 */

export interface CliOptions {
  silent: boolean;
}

export interface LLMAuthStatus {
  type: 'oauth' | 'apikey';
  email?: string;
  valid: boolean;
}

export interface LLMStatusMap {
  claude: LLMAuthStatus[];
  gpt: LLMAuthStatus[];
  gemini: LLMAuthStatus[];
}

export interface ClaudeCodeStatus {
  installed: boolean;
  version: string | null;
  authenticated: boolean | null;
}

export interface DetectedStack {
  type: string;
  path: string;
}

// TechStack은 DetectedStack의 별칭
export type TechStack = DetectedStack;

export interface StackDetails {
  databases: string[];
  stateManagement: string[];
  hosting: string[];
  cicd: string[];
}

export interface DetectionResult {
  stacks: DetectedStack[];
  details: StackDetails;
}

export interface ExternalLLMConfig {
  name: string;
  role: string;
  description: string;
  package: string;
  envKey: string;
}

export interface VibeReferences {
  rules: string[];      // e.g., ["~/.claude/vibe/rules/code-quality.md"]
  languages: string[];  // e.g., ["~/.claude/vibe/languages/typescript-react.md"]
  templates: string[];  // e.g., ["~/.claude/vibe/templates/spec-template.md"]
}

export interface VibeConfig {
  language?: string;
  quality?: { strict: boolean; autoVerify: boolean };
  stacks?: DetectedStack[];
  details?: StackDetails;
  references?: VibeReferences;
  models?: {
    claude?: { enabled: boolean; authType?: string; role?: string; description?: string };
    gpt?: { enabled: boolean; authType?: string; email?: string; role?: string; description?: string };
    gemini?: { enabled: boolean; authType?: string; email?: string; role?: string; description?: string };
  };
  modelOverrides?: Partial<ModelOverrides>;
  priority?: {
    embedding?: Array<'gpt'>;
  };
  uiUxAnalysis?: boolean;
}

export interface OAuthTokens {
  email: string;
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expires: number;
  accountId?: string;
  projectId?: string;
}

// ─── Global Config (~/.vibe/config.json) ────────────────────────────

export interface GptCredentials {
  apiKey?: string;
  oauthRefreshToken?: string;
  oauthEmail?: string;
  createdAt?: string;
}

export interface GeminiCredentials {
  apiKey?: string;
  oauthRefreshToken?: string;
  oauthSource?: 'antigravity' | 'gemini-cli';
  oauthEmail?: string;
  createdAt?: string;
}

export interface TelegramChannelConfig {
  botToken?: string;
  allowedChatIds?: string[];
}

export interface SlackChannelConfig {
  botToken?: string;
  appToken?: string;
  allowedChannelIds?: string[];
}

export interface DiscordChannelConfig {
  botToken?: string;
  allowedGuildIds?: string[];
  allowedChannelIds?: string[];
}

export interface ModelOverrides {
  gpt: string;
  gptSpark: string;
  gemini: string;
  geminiFlash: string;
  geminiSearch: string;
  geminiOauth: string;
  geminiOauthFlash: string;
  claudeArchitecture: string;
  claudeResearch: string;
  claudeReview: string;
  claudeBackground: string;
  embedding: string;
  geminiEmbedding: string;
}

export interface GlobalVibeConfig {
  version: '1';
  credentials?: {
    gpt?: GptCredentials;
    gemini?: GeminiCredentials;
  };
  channels?: {
    telegram?: TelegramChannelConfig;
    slack?: SlackChannelConfig;
    discord?: DiscordChannelConfig;
  };
  models?: Partial<ModelOverrides>;
  settings?: {
    workspaceDir?: string;
  };
}

