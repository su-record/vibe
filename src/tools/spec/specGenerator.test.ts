import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateSpec } from './specGenerator.js';
import { Provisioner } from '../../cli/setup/Provisioner.js';
import type { ParsedPRD, Requirement } from './prdParser.js';
import type { StackDetails } from '../../cli/types.js';

function requirement(index: number): Requirement {
  return {
    id: `REQ-evidence-${String(index).padStart(3, '0')}`,
    description: `Requirement ${index}`,
    acceptanceCriteria: [`Criterion ${index}`],
    priority: 'medium',
  };
}

function prd(count = 1): ParsedPRD {
  return {
    title: 'Evidence Contract',
    description: 'Generate a verifiable task packet.',
    requirements: Array.from({ length: count }, (_, index) => requirement(index + 1)),
    metadata: {
      format: 'markdown',
      hasYamlFrontmatter: false,
      sectionCount: 2,
      requirementCount: count,
      parseWarnings: [],
    },
    raw: '# Evidence Contract',
  };
}

const contractSections = [
  'Context Sources',
  'Assumptions',
  'Evidence Required',
  'Human Taste (Non-Blocking)',
];

describe('Evidence Contract SPEC 생성 경로', () => {
  it('정본 템플릿과 init 템플릿에 계약 섹션이 모두 존재', () => {
    const canonical = fs.readFileSync(
      path.join(process.cwd(), 'vibe', 'templates', 'spec-template.md'),
      'utf-8',
    );
    const initTemplate = Provisioner.generateSpecTemplate([], {
      databases: [],
      stateManagement: [],
      hosting: [],
      cicd: [],
      capabilities: [],
    } satisfies StackDetails);

    for (const section of contractSections) {
      expect(canonical).toContain(section);
      expect(initTemplate).toContain(section);
    }
  });

  it('단일 SPEC은 제공된 컨텍스트·가정·증거·Taste를 보존', () => {
    const generated = generateSpec(prd(), 'evidence-contract', {
      contextSources: ['docs/prd.md'],
      assumptions: ['Node 18+'],
      evidenceRequired: [{
        criterionId: 'REQ-evidence-001',
        evidence: 'npm test exit 0',
      }],
      humanTaste: ['Release copy review'],
    });

    expect(generated.content).toContain('- docs/prd.md');
    expect(generated.content).toContain('- Node 18+');
    expect(generated.content).toContain('- REQ-evidence-001 → npm test exit 0');
    expect(generated.content).toContain('- Release copy review');
  });

  it('분할 SPEC의 master와 모든 phase에도 계약 섹션이 존재', () => {
    const generated = generateSpec(prd(16), 'large-evidence-contract', {
      contextSources: ['docs/large-prd.md'],
      assumptions: ['Node 18+'],
      evidenceRequired: [{
        criterionId: 'REQ-evidence-001',
        evidence: 'npm test exit 0',
      }],
      humanTaste: ['Release copy review'],
    });
    expect(generated.isSplit).toBe(true);
    expect(generated.splitFiles).toBeDefined();
    for (const file of generated.splitFiles ?? []) {
      for (const section of contractSections) {
        expect(file.content).toContain(section);
      }
      expect(file.content).toContain('docs/large-prd.md');
      expect(file.content).toContain('Node 18+');
      expect(file.content).toContain('Release copy review');
    }
    expect(generated.splitFiles?.[0].content)
      .toContain('REQ-evidence-001 → npm test exit 0');
  });
});
