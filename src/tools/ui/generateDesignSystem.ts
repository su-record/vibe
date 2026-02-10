// Generate Design System Tool - 5-stage AI pipeline for complete design system

import { ToolResult, ToolDefinition } from '../../core/types/tool.js';
import { DesignSystemGenerator } from '../../core/lib/ui-ux/DesignSystemGenerator.js';
import { SearchService } from '../../core/lib/ui-ux/SearchService.js';

let generator: DesignSystemGenerator | null = null;

function getGenerator(): DesignSystemGenerator {
  if (!generator) {
    const service = new SearchService();
    service.initialize();
    generator = new DesignSystemGenerator(service);
  }
  return generator;
}

export const generateDesignSystemDefinition: ToolDefinition = {
  name: 'core_ui_generate_design_system',
  description:
    'generate design system|create design|build design system - Generate a complete design system from product description using 5-stage pipeline (Category Detection → Reasoning → Style/Color/Typography/Layout Search → Best Match → CSS Variables)',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Product description (e.g., "SaaS dashboard for fintech", "E-commerce landing page")',
      },
      projectName: {
        type: 'string',
        description: 'Project name for design system persistence',
      },
    },
    required: ['query', 'projectName'],
  },
  annotations: {
    title: 'Generate Design System',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
};

export async function generateDesignSystem(args: {
  query: string;
  projectName: string;
}): Promise<ToolResult> {
  try {
    const gen = getGenerator();
    const designSystem = gen.generate(args.query, args.projectName);
    const markdown = gen.formatMarkdown(designSystem);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              designSystem,
              markdown,
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
          text: `Error: Failed to generate design system - ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
