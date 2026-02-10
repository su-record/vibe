import { z } from 'zod';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enums
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const ActionType = z.enum([
  'file_write',
  'file_delete',
  'bash_exec',
  'git_push',
  'skill_generate',
  'config_modify',
  'dependency_install',
  'external_api_call',
]);
export type ActionType = z.infer<typeof ActionType>;

export const OutcomeType = z.enum(['allowed', 'blocked', 'pending', 'expired']);
export type OutcomeType = z.infer<typeof OutcomeType>;

export const ConfirmationStatus = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);
export type ConfirmationStatus = z.infer<typeof ConfirmationStatus>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Event Schemas (correlationId/timestamp: optional in input, injected by EventBus)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const AgentActionEventSchema = z.object({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  agentId: z.string().min(1),
  actionType: ActionType,
  target: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  riskLevel: RiskLevel.optional(),
});
export type AgentActionEvent = z.infer<typeof AgentActionEventSchema>;

export const PolicyCheckEventSchema = z.object({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  actionEvent: AgentActionEventSchema,
  policies: z.array(z.string()),
  result: z.enum(['allowed', 'blocked', 'needs_confirmation']),
  duration: z.number().nonnegative(),
});
export type PolicyCheckEvent = z.infer<typeof PolicyCheckEventSchema>;

export const RiskAssessedEventSchema = z.object({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  actionEvent: AgentActionEventSchema,
  riskLevel: RiskLevel,
  factors: z.array(z.string()),
  score: z.number().min(0).max(100),
});
export type RiskAssessedEvent = z.infer<typeof RiskAssessedEventSchema>;

export const ConfirmationEventSchema = z.object({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  actionId: z.string().min(1),
  channel: z.string().min(1),
  status: ConfirmationStatus,
  ownerResponse: z.string().optional(),
  expiresAt: z.string().min(1),
});
export type ConfirmationEvent = z.infer<typeof ConfirmationEventSchema>;

export const AuditLogEventSchema = z.object({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  sourceAgentId: z.string().min(1),
});
export type AuditLogEvent = z.infer<typeof AuditLogEventSchema>;

export const ErrorEventSchema = z.object({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  originalEventType: z.string(),
  listenerIndex: z.number(),
  error: z.string(),
  stack: z.string().optional(),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Event Type Map
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const EventSchemaMap = {
  agent_action: AgentActionEventSchema,
  policy_check: PolicyCheckEventSchema,
  risk_assessed: RiskAssessedEventSchema,
  confirmation_requested: ConfirmationEventSchema,
  confirmation_resolved: ConfirmationEventSchema,
  action_executed: AuditLogEventSchema,
  action_blocked: AuditLogEventSchema,
  suggestion_created: AuditLogEventSchema,
  audit_logged: AuditLogEventSchema,
  error: ErrorEventSchema,
} as const;

export type AutonomyEventType = keyof typeof EventSchemaMap;

export type EventPayload<T extends AutonomyEventType> = z.infer<
  (typeof EventSchemaMap)[T]
>;

export type EventInput<T extends AutonomyEventType> = z.input<
  (typeof EventSchemaMap)[T]
>;

export type EnrichedEvent<T> = T & {
  correlationId: string;
  timestamp: string;
};
