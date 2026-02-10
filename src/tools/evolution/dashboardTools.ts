// Dashboard tools for self-evolution Phase 4

import { MemoryStorage } from '../../infra/lib/memory/MemoryStorage.js';
import { GenerationRegistry } from '../../infra/lib/evolution/GenerationRegistry.js';
import { UsageTracker } from '../../infra/lib/evolution/UsageTracker.js';
import { LifecycleManager } from '../../infra/lib/evolution/LifecycleManager.js';
import { RollbackManager } from '../../infra/lib/evolution/RollbackManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';

// ============================================================================
// core_evolution_status
// ============================================================================

export const evolutionStatusDefinition: ToolDefinition = {
  name: 'core_evolution_status',
  description: 'Get evolution system status: generation counts, usage stats, lifecycle state.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Project directory path' },
    },
    required: [],
  },
  annotations: {
    title: 'Evolution Status',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function evolutionStatus(args: { projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const registry = new GenerationRegistry(storage);
    const stats = registry.getStats();

    const lines = [
      'Evolution System Status',
      `  Total generations: ${stats.total}`,
      '  By type:',
      ...Object.entries(stats.byType).map(([k, v]) => `    ${k}: ${v}`),
      '  By status:',
      ...Object.entries(stats.byStatus).map(([k, v]) => `    ${k}: ${v}`),
    ];

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_evolution_approve
// ============================================================================

export const evolutionApproveDefinition: ToolDefinition = {
  name: 'core_evolution_approve',
  description: 'Approve a draft generation (draft → testing).',
  inputSchema: {
    type: 'object',
    properties: {
      generationId: { type: 'string', description: 'Generation ID to approve' },
      projectPath: { type: 'string', description: 'Project directory path' },
    },
    required: ['generationId'],
  },
  annotations: {
    title: 'Approve Generation',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function evolutionApprove(args: { generationId: string; projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const lifecycle = new LifecycleManager(storage);
    const success = lifecycle.approve(args.generationId);

    return {
      content: [{
        type: 'text',
        text: success
          ? `Approved: ${args.generationId} (draft → testing)`
          : `Failed: ${args.generationId} not found or not in draft status`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_evolution_reject
// ============================================================================

export const evolutionRejectDefinition: ToolDefinition = {
  name: 'core_evolution_reject',
  description: 'Reject a draft generation (draft → deleted).',
  inputSchema: {
    type: 'object',
    properties: {
      generationId: { type: 'string', description: 'Generation ID to reject' },
      projectPath: { type: 'string', description: 'Project directory path' },
    },
    required: ['generationId'],
  },
  annotations: {
    title: 'Reject Generation',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function evolutionReject(args: { generationId: string; projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const lifecycle = new LifecycleManager(storage);
    const success = lifecycle.reject(args.generationId);

    return {
      content: [{
        type: 'text',
        text: success
          ? `Rejected: ${args.generationId} (draft → deleted)`
          : `Failed: ${args.generationId} not found or not in draft status`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_evolution_disable
// ============================================================================

export const evolutionDisableDefinition: ToolDefinition = {
  name: 'core_evolution_disable',
  description: 'Disable a specific auto-generated artifact.',
  inputSchema: {
    type: 'object',
    properties: {
      generationId: { type: 'string', description: 'Generation ID to disable' },
      projectPath: { type: 'string', description: 'Project directory path' },
    },
    required: ['generationId'],
  },
  annotations: {
    title: 'Disable Generation',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function evolutionDisable(args: { generationId: string; projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const rollback = new RollbackManager(storage);
    rollback.disable(args.generationId);

    return {
      content: [{ type: 'text', text: `Disabled: ${args.generationId}` }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}

// ============================================================================
// core_evolution_rollback
// ============================================================================

export const evolutionRollbackDefinition: ToolDefinition = {
  name: 'core_evolution_rollback',
  description: 'Rollback a generation to its previous version.',
  inputSchema: {
    type: 'object',
    properties: {
      generationId: { type: 'string', description: 'Generation ID to rollback' },
      projectPath: { type: 'string', description: 'Project directory path' },
    },
    required: ['generationId'],
  },
  annotations: {
    title: 'Rollback Generation',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function evolutionRollback(args: { generationId: string; projectPath?: string }): Promise<ToolResult> {
  try {
    const storage = new MemoryStorage(args.projectPath || process.cwd());
    const rollback = new RollbackManager(storage);
    rollback.rollback(args.generationId);

    return {
      content: [{ type: 'text', text: `Rolled back: ${args.generationId} to previous version` }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
