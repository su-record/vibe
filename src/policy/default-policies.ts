/**
 * Default Safety and Configuration Policies
 * Phase 2: Policy Integration
 *
 * Safety policies (deny-override): dangerous command block, SSRF prevention
 * Configuration policies: rate limiting info
 */

import type { PolicyFile } from './types.js';

/** Get default safety policies (deny-override) */
export function getDefaultSafetyPolicies(): PolicyFile[] {
  return [
    {
      name: 'dangerous-command-block',
      version: '1.0.0',
      type: 'safety',
      enabled: true,
      source: 'builtin',
      rules: [
        {
          id: 'safety-dangerous-cmd',
          description: 'Block dangerous system commands in claude_code',
          condition: {
            'action.type': 'tool_call',
            'action.target': 'claude_code',
            'action.command': { regex: '(rm\\s+-rf|sudo\\s+|chmod\\s+777|mkfs|dd\\s+if=)' },
          },
          effect: 'reject',
          message: 'Dangerous command blocked by safety policy',
          severity: 'critical',
        },
      ],
    },
    {
      name: 'send-tool-warning',
      version: '1.0.0',
      type: 'safety',
      enabled: true,
      source: 'builtin',
      rules: [
        {
          id: 'safety-send-warn',
          description: 'Warn when using send_* tools',
          condition: {
            'action.type': 'tool_call',
            'action.target': { regex: '^send_' },
          },
          effect: 'warn',
          message: 'Message sending tool detected — verify target is in allowlist',
          severity: 'medium',
        },
      ],
    },
    {
      name: 'ssrf-prevention',
      version: '1.0.0',
      type: 'safety',
      enabled: true,
      source: 'builtin',
      rules: [
        {
          id: 'safety-ssrf-block',
          description: 'Block web_browse to private IP ranges',
          condition: {
            'action.type': 'tool_call',
            'action.target': 'web_browse',
            'action.command': { regex: '(10\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|192\\.168\\.|127\\.|localhost)' },
          },
          effect: 'reject',
          message: 'Private IP address access blocked by SSRF prevention policy',
          severity: 'high',
        },
      ],
    },
  ];
}

/** Get default configuration policies */
export function getDefaultConfigPolicies(): PolicyFile[] {
  return [
    {
      name: 'rate-limit-info',
      version: '1.0.0',
      type: 'configuration',
      enabled: true,
      source: 'builtin',
      rules: [
        {
          id: 'config-rate-limit-info',
          description: 'Rate limits: claude_code 10/min, web_browse 20/min, others 30/min',
          condition: {
            'action.type': 'tool_call',
          },
          effect: 'warn',
          message: 'Tool call subject to rate limiting',
          severity: 'low',
        },
      ],
    },
  ];
}
