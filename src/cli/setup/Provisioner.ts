/**
 * Provisioner - Post-init step for project-specific agent recommendations
 * Generates recommended agents and SPEC template based on detected tech stacks
 */

import fs from 'fs';
import path from 'path';
import type { DetectedStack, StackDetails } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface RecommendedAgent {
  name: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface RecommendedAgentsConfig {
  generatedAt: string;
  projectStacks: string[];
  agents: RecommendedAgent[];
}

export interface ProvisionResult {
  configEnhanced: boolean;
  agentsGenerated: boolean;
  specTemplateGenerated: boolean;
}

// ============================================================================
// Stack-to-agent mapping
// ============================================================================

interface AgentMapping {
  high: RecommendedAgent[];
  medium: RecommendedAgent[];
}

const STACK_AGENT_MAP: Record<string, AgentMapping> = {
  'typescript-react': {
    high: [
      { name: 'react-reviewer', category: 'review', priority: 'high', rationale: 'React component patterns and hooks validation' },
      { name: 'typescript-reviewer', category: 'review', priority: 'high', rationale: 'TypeScript type safety enforcement' },
    ],
    medium: [
      { name: 'performance-reviewer', category: 'review', priority: 'medium', rationale: 'React render optimization' },
    ],
  },
  'typescript-nextjs': {
    high: [
      { name: 'react-reviewer', category: 'review', priority: 'high', rationale: 'React/Next.js patterns and SSR validation' },
      { name: 'typescript-reviewer', category: 'review', priority: 'high', rationale: 'TypeScript type safety enforcement' },
    ],
    medium: [
      { name: 'performance-reviewer', category: 'review', priority: 'medium', rationale: 'SSR/ISR performance optimization' },
    ],
  },
  'typescript-node': {
    high: [
      { name: 'typescript-reviewer', category: 'review', priority: 'high', rationale: 'TypeScript type safety enforcement' },
      { name: 'data-integrity-reviewer', category: 'review', priority: 'high', rationale: 'Data validation and transaction safety' },
    ],
    medium: [
      { name: 'test-coverage-reviewer', category: 'review', priority: 'medium', rationale: 'Backend test coverage assurance' },
    ],
  },
  'typescript-nestjs': {
    high: [
      { name: 'typescript-reviewer', category: 'review', priority: 'high', rationale: 'TypeScript type safety enforcement' },
      { name: 'data-integrity-reviewer', category: 'review', priority: 'high', rationale: 'Data validation and transaction safety' },
    ],
    medium: [
      { name: 'test-coverage-reviewer', category: 'review', priority: 'medium', rationale: 'Backend test coverage assurance' },
    ],
  },
  'python-fastapi': {
    high: [
      { name: 'python-reviewer', category: 'review', priority: 'high', rationale: 'Python PEP 8 and type hints validation' },
    ],
    medium: [
      { name: 'test-coverage-reviewer', category: 'review', priority: 'medium', rationale: 'API test coverage assurance' },
    ],
  },
  'python-django': {
    high: [
      { name: 'python-reviewer', category: 'review', priority: 'high', rationale: 'Python PEP 8 and Django patterns validation' },
    ],
    medium: [
      { name: 'test-coverage-reviewer', category: 'review', priority: 'medium', rationale: 'Django test coverage assurance' },
    ],
  },
  'ruby-rails': {
    high: [
      { name: 'rails-reviewer', category: 'review', priority: 'high', rationale: 'Rails Way compliance and ActiveRecord patterns' },
      { name: 'data-integrity-reviewer', category: 'review', priority: 'high', rationale: 'Migration safety and transaction management' },
    ],
    medium: [
      { name: 'security-reviewer', category: 'review', priority: 'medium', rationale: 'Rails security best practices' },
    ],
  },
};

const UNIVERSAL_AGENTS: RecommendedAgent[] = [
  { name: 'security-reviewer', category: 'review', priority: 'medium', rationale: 'OWASP Top 10 vulnerability detection' },
  { name: 'architecture-reviewer', category: 'review', priority: 'medium', rationale: 'Layer violations and SOLID principles' },
  { name: 'simplicity-reviewer', category: 'review', priority: 'medium', rationale: 'Over-abstraction and YAGNI detection' },
  { name: 'git-history-reviewer', category: 'review', priority: 'medium', rationale: 'Risk pattern detection from commit history' },
];

// ============================================================================
// Provisioner
// ============================================================================

export class Provisioner {
  private constructor() {
    // Static-only class
  }

  static provision(
    projectRoot: string,
    detectedStacks: DetectedStack[],
    stackDetails: StackDetails,
  ): ProvisionResult {
    const result: ProvisionResult = {
      configEnhanced: false,
      agentsGenerated: false,
      specTemplateGenerated: false,
    };

    const stackTypes = detectedStacks.map(s => s.type);

    // Generate recommended agents config
    const agentsPath = path.join(
      projectRoot, '.vibe', 'recommended-agents.json',
    );
    if (!fs.existsSync(agentsPath)) {
      const agents = Provisioner.generateRecommendedAgents(stackTypes);
      const config: RecommendedAgentsConfig = {
        generatedAt: new Date().toISOString(),
        projectStacks: stackTypes,
        agents,
      };
      const dir = path.dirname(agentsPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(agentsPath, JSON.stringify(config, null, 2));
      result.agentsGenerated = true;
    }

    // Generate SPEC template
    const specPath = path.join(
      projectRoot, '.vibe', 'specs', 'project-spec-template.md',
    );
    if (!fs.existsSync(specPath)) {
      const template = Provisioner.generateSpecTemplate(
        stackTypes, stackDetails,
      );
      const dir = path.dirname(specPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(specPath, template);
      result.specTemplateGenerated = true;
    }

    result.configEnhanced =
      result.agentsGenerated || result.specTemplateGenerated;
    return result;
  }

  static generateRecommendedAgents(stacks: string[]): RecommendedAgent[] {
    const seen = new Set<string>();
    const agents: RecommendedAgent[] = [];

    const addAgent = (agent: RecommendedAgent): void => {
      if (seen.has(agent.name)) return;
      seen.add(agent.name);
      agents.push(agent);
    };

    // Stack-specific agents
    for (const stack of stacks) {
      const mapping = STACK_AGENT_MAP[stack];
      if (mapping) {
        mapping.high.forEach(addAgent);
        mapping.medium.forEach(addAgent);
        continue;
      }
      // Prefix match (e.g., 'typescript' from 'typescript-vue')
      const prefix = stack.split('-').slice(0, 2).join('-');
      const prefixMapping = STACK_AGENT_MAP[prefix];
      if (prefixMapping) {
        prefixMapping.high.forEach(addAgent);
        prefixMapping.medium.forEach(addAgent);
      }
    }

    // Universal agents
    UNIVERSAL_AGENTS.forEach(addAgent);

    return agents;
  }

  static generateSpecTemplate(
    stacks: string[],
    details: StackDetails,
  ): string {
    const stackList = stacks.length > 0
      ? stacks.map(s => `- ${s}`).join('\n')
      : '- (not detected)';

    const dbSection = details.databases.length > 0
      ? details.databases.join(', ')
      : 'N/A';

    const stateSection = details.stateManagement.length > 0
      ? details.stateManagement.join(', ')
      : 'N/A';

    return `# [Feature Name] SPEC

## Overview
<!-- Brief description of the feature -->

## Tech Stack
${stackList}

### Infrastructure
- **Databases**: ${dbSection}
- **State Management**: ${stateSection}

## Problem Statement
<!-- What problem does this solve? -->

## Proposed Solution
<!-- High-level approach -->

## Requirements

### Functional
1. <!-- Requirement 1 -->

### Non-Functional
1. <!-- Performance, security, accessibility -->

## API Design
<!-- Endpoints, request/response schemas -->

## Data Model
<!-- Schema changes, migrations -->

## Test Strategy
- Unit tests: <!-- scope -->
- Integration tests: <!-- scope -->
- E2E tests: <!-- scope -->

## Acceptance Criteria
- [ ] <!-- Criterion 1 -->

## References
<!-- Links to relevant docs, designs, PRs -->
`;
  }
}
