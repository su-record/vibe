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
  gpt: LLMAuthStatus | null;
  gemini: LLMAuthStatus | null;
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
    gpt?: { enabled: boolean; authType?: string; email?: string; role?: string; description?: string; apiKey?: string };
    gemini?: { enabled: boolean; authType?: string; email?: string; role?: string; description?: string; apiKey?: string };
  };
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

