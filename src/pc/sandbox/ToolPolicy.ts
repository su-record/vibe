/**
 * Tool Policy — Phase 5-3
 *
 * 6-stage policy chain: Profile → Global → User → Channel → Sandbox → SubAgent.
 * Wildcard pattern matching for tool groups.
 */

import type {
  PolicyLevel,
  PolicyAction,
  PolicyRule,
  PolicyLayer,
  PolicyEvalResult,
  SandboxLogger,
} from './types.js';

// ============================================================================
// Tool Groups
// ============================================================================

const TOOL_GROUPS: Record<string, string[]> = {
  'group:fs': ['core_find_symbol', 'core_find_references', 'core_analyze_dependency_graph'],
  'group:runtime': ['core_sandbox_exec'],
  'group:browser': ['core_browser_snapshot', 'core_browser_act', 'core_browser_navigate', 'core_browser_screenshot', 'core_browser_status'],
  'group:google': ['core_google_auth', 'core_google_gmail_send', 'core_google_gmail_search', 'core_google_drive_upload', 'core_google_drive_download', 'core_google_sheets_read', 'core_google_sheets_write', 'core_google_calendar_list', 'core_google_calendar_create'],
  'group:voice': ['core_voice_status', 'core_tts_speak', 'core_stt_transcribe'],
  'group:vision': ['core_vision_start', 'core_vision_stop', 'core_vision_mode', 'core_vision_snapshot', 'core_vision_ask'],
};

// ============================================================================
// Pattern Matching
// ============================================================================

/** Match tool name against pattern (supports wildcards and groups) */
export function matchPattern(pattern: string, toolName: string): boolean {
  // Group expansion
  if (pattern.startsWith('group:')) {
    const tools = TOOL_GROUPS[pattern];
    return tools ? tools.includes(toolName) : false;
  }

  // Wildcard pattern (e.g., `core_browser_*`)
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(toolName);
  }

  // Exact match
  return pattern === toolName;
}

// ============================================================================
// Policy Evaluator
// ============================================================================

export class ToolPolicyEvaluator {
  private layers: PolicyLayer[] = [];
  private logger: SandboxLogger;

  constructor(logger: SandboxLogger) {
    this.logger = logger;
  }

  /** Set policy layers (ordered: profile first, subagent last) */
  setLayers(layers: PolicyLayer[]): void {
    this.layers = layers;
  }

  addLayer(layer: PolicyLayer): void {
    this.layers.push(layer);
    // Re-sort to maintain correct order
    const order: PolicyLevel[] = ['profile', 'global', 'user', 'channel', 'sandbox', 'subagent'];
    this.layers.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  }

  /** Evaluate tool against all policy layers */
  evaluate(toolName: string): PolicyEvalResult {
    for (const layer of this.layers) {
      for (const rule of layer.rules) {
        if (matchPattern(rule.pattern, toolName)) {
          const result: PolicyEvalResult = {
            allowed: rule.action === 'allow',
            action: rule.action,
            matchedLevel: layer.level,
            matchedPattern: rule.pattern,
            reason: rule.reason,
          };
          this.logger('debug', `Policy eval: ${toolName} → ${rule.action} at ${layer.level}`);
          return result;
        }
      }
    }

    // Default: deny if no rule matches
    return {
      allowed: false,
      action: 'deny',
      matchedLevel: 'profile',
      matchedPattern: '*',
      reason: '일치하는 정책 규칙이 없습니다.',
    };
  }

  /** Get all layers */
  getLayers(): PolicyLayer[] {
    return [...this.layers];
  }
}

// ============================================================================
// Default Policies
// ============================================================================

export function getDefaultSaaSPolicy(): PolicyLayer[] {
  return [
    {
      level: 'profile',
      rules: [
        { pattern: 'group:browser', action: 'allow' },
        { pattern: 'group:google', action: 'allow' },
        { pattern: 'group:voice', action: 'allow' },
        { pattern: 'group:vision', action: 'allow' },
      ],
    },
    {
      level: 'global',
      rules: [
        { pattern: 'core_sandbox_exec', action: 'ask', reason: '명령 실행은 승인이 필요합니다.' },
      ],
    },
    {
      level: 'sandbox',
      rules: [
        { pattern: 'core_browser_*', action: 'allow' },
        { pattern: 'core_google_*', action: 'allow' },
        { pattern: 'core_voice_*', action: 'allow' },
        { pattern: 'core_vision_*', action: 'allow' },
      ],
    },
  ];
}

export function getDefaultLocalPolicy(): PolicyLayer[] {
  return [
    {
      level: 'profile',
      rules: [
        { pattern: '*', action: 'allow', reason: '로컬 모드: 모든 도구 허용' },
      ],
    },
  ];
}
