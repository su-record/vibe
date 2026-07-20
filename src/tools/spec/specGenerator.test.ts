import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateSpec } from './specGenerator.js';
import { compileExecutionPacket } from './executionPacket.js';
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
        criterionId: 'D1',
        evidence: 'npm test exit 0',
      }],
      humanTaste: ['Release copy review'],
    });

    expect(generated.content).toContain('- docs/prd.md');
    expect(generated.content).toContain('- Node 18+');
    expect(generated.content).toContain('- D1 → npm test exit 0');
    expect(generated.content).toContain('- Release copy review');
  });

  it('분할 SPEC의 master와 모든 phase에도 계약 섹션이 존재', () => {
    const generated = generateSpec(prd(16), 'large-evidence-contract', {
      contextSources: ['docs/large-prd.md'],
      assumptions: ['Node 18+'],
      evidenceRequired: [{
        criterionId: 'D1',
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
      .toContain('D1 → npm test exit 0');
  });

  it('단일 및 분할 phase SPEC이 execution packet으로 컴파일됨', () => {
    const single = generateSpec(prd(), 'evidence-contract');
    const split = generateSpec(prd(16), 'large-evidence-contract');
    const singlePacket = compileExecutionPacket({
      canonicalSpec: single.content,
      canonicalSpecPath: '.vibe/specs/evidence-contract.md',
      profile: 'codex',
    });
    expect(singlePacket.ok).toBe(true);

    for (const file of split.splitFiles?.filter(item => item.path !== '_index.md') ?? []) {
      const packet = compileExecutionPacket({
        canonicalSpec: file.content,
        canonicalSpecPath: `.vibe/specs/large-evidence-contract/${file.path}`,
        profile: 'codex',
      });
      expect(packet.ok, file.path).toBe(true);
    }
  });

  it('분할 phase는 master 제약을 materialize하고 REQ를 중복 배정하지 않음', () => {
    const source = prd(16);
    if (source.requirements[0]) source.requirements[0].priority = 'high';
    const split = generateSpec(source, 'safe-split', {
      additionalConstraints: ['Never delete data'],
    });
    const phases = split.splitFiles?.filter(item => item.path !== '_index.md') ?? [];
    const packets = phases.map(file => compileExecutionPacket({
      canonicalSpec: file.content,
      canonicalSpecPath: `.vibe/specs/safe-split/${file.path}`,
      profile: 'codex',
    }));
    expect(packets.every(packet => packet.ok)).toBe(true);
    for (const packet of packets) {
      if (!packet.ok) continue;
      expect(packet.packet.constraints).toContain('Never delete data');
    }
    const phaseContents = phases.map(file => file.content).join('\n');
    expect(phaseContents.match(/\| REQ-evidence-001 \|/g)).toHaveLength(1);
  });
});
