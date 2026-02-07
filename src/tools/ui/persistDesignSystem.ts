// Persist Design System Tool - Write design system to MASTER.md and page overrides

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { DesignSystemGenerator } from '../../lib/ui-ux/DesignSystemGenerator.js';
import { SearchService } from '../../lib/ui-ux/SearchService.js';

let generator: DesignSystemGenerator | null = null;

function getGenerator(): DesignSystemGenerator {
  if (!generator) {
    const service = new SearchService();
    service.initialize();
    generator = new DesignSystemGenerator(service);
  }
  return generator;
}

export const persistDesignSystemDefinition: ToolDefinition = {
  name: 'core_ui_persist_design_system',
  description:
    'save design system|persist design|write design system - Generate and persist design system as MASTER.md and optional page-specific overrides to project directory',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Product description (used to generate design system)',
      },
      projectName: {
        type: 'string',
        description: 'Project name (design system directory)',
      },
      page: {
        type: 'string',
        description:
          'Optional page name for page-specific overrides (e.g., "landing", "dashboard")',
      },
    },
    required: ['query', 'projectName'],
  },
  annotations: {
    title: 'Persist Design System',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export async function persistDesignSystem(args: {
  query: string;
  projectName: string;
  page?: string;
}): Promise<ToolResult> {
  try {
    const gen = getGenerator();
    const designSystem = gen.generate(args.query, args.projectName);
    const outputPath = gen.persist(designSystem, args.projectName, args.page);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              outputPath,
              projectName: args.projectName,
              page: args.page ?? null,
              category: designSystem.category,
              severity: designSystem.severity,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return {
      content: [
        {
          type: 'text',
          text: `Error: Failed to persist design system - ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
