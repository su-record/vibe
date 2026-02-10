import { z } from 'zod';
import type { AgentActionEvent, RiskLevel } from './schemas.js';

const CONTROL_CHAR_RE = /[\u0000-\u001F]/g;

const SECURITY_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  /[/\\]auth[/\\]/i,
  /[/\\]security[/\\]/i,
  /[/\\]\.env/i,
  /[/\\]secrets/i,
];

const SENTINEL_PROTECTED_RE = /^src[\\/]lib[\\/]autonomy[\\/]/;

const DANGEROUS_BASH_RE =
  /\b(rm\s+-rf|kill\s+-9|drop\s+table|truncate|shutdown|reboot|mkfs|dd\s+if=)\b/i;

const AUTH_CREDENTIAL_RE = /\b(api[_-]?key|secret|token|password|auth|bearer)\b/i;

const SCORE_DEFAULTS: Record<RiskLevel, number> = {
  LOW: 15,
  MEDIUM: 50,
  HIGH: 80,
};

export interface RiskAssessment {
  riskLevel: RiskLevel;
  score: number;
  factors: string[];
  reasoning: string;
  blocked?: boolean;
}

export interface ClassificationContext {
  recentDeleteCount?: number;
}

export interface CustomRiskRule {
  actionType: string;
  targetPattern?: string;
  riskLevel: RiskLevel;
  condition?: string;
}

const CustomRiskRuleSchema = z.object({
  actionType: z.string().min(1),
  targetPattern: z.string().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  condition: z.string().optional(),
});

export class RiskClassifier {
  private readonly customRules: CustomRiskRule[];

  constructor(customRules?: CustomRiskRule[]) {
    this.customRules = (customRules ?? []).filter((rule) => {
      try {
        CustomRiskRuleSchema.parse(rule);
        return true;
      } catch {
        return false;
      }
    });
  }

  classify(action: AgentActionEvent, context?: ClassificationContext): RiskAssessment {
    const sanitized = this.sanitizeAction(action);
    const customResult = this.evaluateCustomRules(sanitized);
    if (customResult) return customResult;
    return this.evaluateDefaultRules(sanitized, context);
  }

  private sanitizeAction(action: AgentActionEvent): AgentActionEvent {
    return {
      ...action,
      agentId: action.agentId.replace(CONTROL_CHAR_RE, ''),
      target: action.target.replace(CONTROL_CHAR_RE, ''),
    };
  }

  private evaluateCustomRules(action: AgentActionEvent): RiskAssessment | null {
    for (const rule of this.customRules) {
      if (rule.actionType !== action.actionType) continue;
      if (rule.targetPattern) {
        try {
          if (!new RegExp(rule.targetPattern, 'i').test(action.target)) continue;
        } catch {
          continue;
        }
      }
      return this.makeAssessment(
        rule.riskLevel,
        [`Custom rule matched: ${rule.actionType}`],
        `Custom rule override for ${rule.actionType}`,
      );
    }
    return null;
  }

  private evaluateDefaultRules(
    action: AgentActionEvent,
    context?: ClassificationContext,
  ): RiskAssessment {
    const handlers: Record<string, () => RiskAssessment> = {
      file_write: () => this.classifyFileWrite(action),
      file_delete: () => this.classifyFileDelete(action, context),
      bash_exec: () => this.classifyBashExec(action),
      git_push: () => this.classifyGitPush(action),
      skill_generate: () => this.classifySkillGenerate(action),
      config_modify: () => this.classifyConfigModify(action),
      dependency_install: () => this.classifyDependencyInstall(),
      external_api_call: () => this.classifyExternalApiCall(action),
    };
    const handler = handlers[action.actionType];
    if (handler) return handler();
    return this.makeAssessment('LOW', [], `Unknown action type: ${action.actionType}`);
  }

  private classifyFileWrite(action: AgentActionEvent): RiskAssessment {
    const normalized = action.target.replace(/\\/g, '/').replace(/^\.\//, '');
    if (SENTINEL_PROTECTED_RE.test(normalized)) {
      return {
        riskLevel: 'HIGH',
        score: 100,
        factors: ['Sentinel protected file modification attempted'],
        reasoning: 'Modifying files in src/lib/autonomy/ is blocked',
        blocked: true,
      };
    }
    for (const pattern of SECURITY_FILE_PATTERNS) {
      if (pattern.test(action.target)) {
        return this.makeAssessment(
          'HIGH',
          [`Security-sensitive file: ${action.target}`],
          'Security file modification requires elevated risk level',
        );
      }
    }
    return this.makeAssessment('LOW', [], 'Standard file write operation');
  }

  private classifyFileDelete(
    action: AgentActionEvent,
    context?: ClassificationContext,
  ): RiskAssessment {
    if (context?.recentDeleteCount !== undefined && context.recentDeleteCount >= 5) {
      return this.makeAssessment(
        'HIGH',
        [`Mass delete detected: ${context.recentDeleteCount} files in last 60s`],
        'Mass file deletion detected',
      );
    }
    return this.makeAssessment('MEDIUM', [], 'File deletion operation');
  }

  private classifyBashExec(action: AgentActionEvent): RiskAssessment {
    if (DANGEROUS_BASH_RE.test(action.target)) {
      return this.makeAssessment(
        'HIGH',
        [`Dangerous command detected in: ${action.target}`],
        'Bash command contains dangerous patterns',
      );
    }
    return this.makeAssessment('MEDIUM', [], 'Standard bash execution');
  }

  private classifyGitPush(action: AgentActionEvent): RiskAssessment {
    const paramsStr = JSON.stringify(action.params ?? {});
    const combined = `${action.target} ${paramsStr}`;
    if (/--force\b/.test(combined) || /["']?force["']?\s*:\s*true/.test(paramsStr)) {
      return this.makeAssessment(
        'HIGH',
        ['Force push detected'],
        'Git force push requires elevated risk level',
      );
    }
    return this.makeAssessment('HIGH', [], 'Git push operation');
  }

  private classifySkillGenerate(action: AgentActionEvent): RiskAssessment {
    if (/\brule\b/i.test(action.target)) {
      return this.makeAssessment(
        'MEDIUM',
        ['Rule generation detected'],
        'Skill generation involving rules',
      );
    }
    return this.makeAssessment('LOW', [], 'Standard skill generation');
  }

  private classifyConfigModify(action: AgentActionEvent): RiskAssessment {
    if (/\bsentinel\b/i.test(action.target)) {
      return this.makeAssessment(
        'HIGH',
        ['Sentinel configuration modification'],
        'Modifying sentinel configuration requires elevated risk level',
      );
    }
    return this.makeAssessment('MEDIUM', [], 'Configuration modification');
  }

  private classifyDependencyInstall(): RiskAssessment {
    return this.makeAssessment('MEDIUM', [], 'Dependency installation');
  }

  private classifyExternalApiCall(action: AgentActionEvent): RiskAssessment {
    const paramsStr = JSON.stringify(action.params ?? {});
    if (AUTH_CREDENTIAL_RE.test(paramsStr)) {
      return this.makeAssessment(
        'HIGH',
        ['Authentication credentials detected in API call'],
        'External API call with authentication',
      );
    }
    return this.makeAssessment('LOW', [], 'Standard external API call');
  }

  private makeAssessment(
    riskLevel: RiskLevel,
    factors: string[],
    reasoning: string,
  ): RiskAssessment {
    return { riskLevel, score: SCORE_DEFAULTS[riskLevel], factors, reasoning };
  }
}
