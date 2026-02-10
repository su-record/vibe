import { z } from 'zod';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Config Schemas
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const NotificationChannelEnum = z.enum(['telegram', 'slack', 'web']);

export const SentinelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  notificationChannels: z.array(NotificationChannelEnum).default(['telegram', 'slack', 'web']),
  confirmationTimeout: z.number().min(60).max(3600).default(300),
  rules: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const ProactiveConfigSchema = z.object({
  enabled: z.boolean().default(true),
  modules: z
    .array(z.enum(['security', 'performance', 'quality', 'dependency']))
    .default(['security', 'performance', 'quality', 'dependency']),
});

export const AutonomyModeEnum = z.enum(['suggest', 'auto', 'disabled']);

export const AutonomyConfigSchema = z.object({
  mode: AutonomyModeEnum.default('suggest'),
  proactive: ProactiveConfigSchema.default(() => ProactiveConfigSchema.parse({})),
  maxConcurrentSteps: z.number().min(1).max(5).default(3),
  maxStepTimeout: z.number().min(60).max(3600).default(600),
});

export const FullConfigSchema = z.object({
  sentinel: SentinelConfigSchema.default(() => SentinelConfigSchema.parse({})),
  autonomy: AutonomyConfigSchema.default(() => AutonomyConfigSchema.parse({})),
});

export type SentinelConfig = z.infer<typeof SentinelConfigSchema>;
export type AutonomyConfig = z.infer<typeof AutonomyConfigSchema>;
export type FullConfig = z.infer<typeof FullConfigSchema>;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Config Loader
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function loadConfig(rawConfig: unknown): FullConfig {
  try {
    return FullConfigSchema.parse(rawConfig ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      for (const issue of err.issues) {
        process.stderr.write(
          `[AutonomyConfig] Invalid config at '${issue.path.join('.')}': ${issue.message} — using default\n`,
        );
      }
    }
    // Return defaults on validation failure
    return FullConfigSchema.parse({});
  }
}

export function getDefaultConfig(): FullConfig {
  return FullConfigSchema.parse({});
}
