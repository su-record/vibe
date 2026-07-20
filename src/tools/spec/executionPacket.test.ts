import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  compileExecutionPacket,
  validateExecutionPacket,
  writeExecutionPacket,
  type CompileExecutionPacketInput,
} from './executionPacket.js';

const canonicalSpec = `# SPEC: Example

## Context Sources
- docs/prd.md

## Assumptions
- PostgreSQL 16 is available

## Constraints
- Preserve backward compatibility
- Do not expose secrets

## Requirements

| ID | Requirement | Done Criteria |
|----|-------------|---------------|
| REQ-example-001 | Build remains valid | D1 |
| REQ-example-002 | Tests remain valid | D2 |

## Done Criteria (deterministic gates)

| # | Criterion | Verified by |
|---|-----------|-------------|
| D1 | Build succeeds | npm run build exit 0 |
| D2 | Tests pass | npm test exit 0 |

### Evidence Required
- D1 → build command result
- D2 → test command result
`;

function input(
  overrides: Partial<CompileExecutionPacketInput> = {},
): CompileExecutionPacketInput {
  return {
    canonicalSpec,
    canonicalSpecPath: '.vibe/specs/example.md',
    profile: 'codex',
    ...overrides,
  };
}

describe('Execution Packet Compiler', () => {
  it('동일 입력은 source/hash와 계약을 보존한 byte-identical packet을 생성', () => {
    const first = compileExecutionPacket(input());
    const second = compileExecutionPacket(input());

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    if (!first.ok) return;
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.packet.canonicalSpecHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.packet.requirements.map(item => item.id))
      .toEqual(['REQ-example-001', 'REQ-example-002']);
    expect(first.packet.doneCriteria.map(item => item.id)).toEqual(['D1', 'D2']);
    expect(first.packet.evidenceRequired.map(item => item.criterionId))
      .toEqual(['D1', 'D2']);
    expect(first.packet.constraints).toEqual([
      'Preserve backward compatibility',
      'Do not expose secrets',
    ]);
    expect(first.packet.sourcePointers).toContainEqual({
      id: 'D1',
      path: '.vibe/specs/example.md',
      line: 24,
    });
    expect(first.audit.preservedCriterionIds).toEqual(['D1', 'D2']);
  });

  it('Codex와 Claude Code 프로파일은 동일한 핵심 계약을 보존', () => {
    const codex = compileExecutionPacket(input({ profile: 'codex' }));
    const claude = compileExecutionPacket(input({ profile: 'claude-code' }));

    expect(codex.ok).toBe(true);
    expect(claude.ok).toBe(true);
    if (!codex.ok || !claude.ok) return;
    expect(codex.packet.profile).not.toBe(claude.packet.profile);
    expect(codex.packet.contextBudget).not.toBe(claude.packet.contextBudget);
    expect(codex.packet.requirements).toEqual(claude.packet.requirements);
    expect(codex.packet.constraints).toEqual(claude.packet.constraints);
    expect(codex.packet.doneCriteria).toEqual(claude.packet.doneCriteria);
    expect(codex.packet.evidenceRequired).toEqual(claude.packet.evidenceRequired);
    expect(codex.packet.isolationPolicy).toEqual({
      reloadPerScenario: true,
      includeExplorationLogs: false,
      stateSource: 'disk',
    });
  });

  it('누락된 evidence를 오류 코드와 원본 위치로 보고하고 packet을 생성하지 않음', () => {
    const result = compileExecutionPacket(input({
      canonicalSpec: canonicalSpec.replace('- D2 → test command result\n', ''),
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      code: 'MISSING_EVIDENCE',
      message: 'Missing evidence: D2',
      sourceId: 'D2',
      sourcePointer: { path: '.vibe/specs/example.md', line: 25 },
    });
    expect(result).not.toHaveProperty('packet');
  });

  it('알 수 없는 criterion 선택과 evidence 참조를 거부', () => {
    const unknownSelection = compileExecutionPacket(input({
      selectedRequirementIds: ['REQ-example-999'],
    }));
    const unknownEvidence = compileExecutionPacket(input({
      canonicalSpec: `${canonicalSpec}- D9 → unknown proof\n`,
    }));

    expect(unknownSelection.ok).toBe(false);
    expect(unknownEvidence.ok).toBe(false);
    if (!unknownSelection.ok) {
      expect(unknownSelection.errors.map(error => error.code))
        .toContain('UNKNOWN_REQUIREMENT_ID');
    }
    if (!unknownEvidence.ok) {
      expect(unknownEvidence.errors.map(error => error.code))
        .toContain('UNKNOWN_EVIDENCE_ID');
    }
  });

  it('빈 requirement 선택과 알 수 없는 Done Criterion 매핑을 거부', () => {
    const empty = compileExecutionPacket(input({ selectedRequirementIds: [] }));
    const invalidMapping = compileExecutionPacket(input({
      canonicalSpec: canonicalSpec.replace('| D1 |', '| D9 |'),
    }));

    expect(empty).toMatchObject({
      ok: false,
      errors: [{ code: 'EMPTY_SELECTION' }],
    });
    expect(invalidMapping.ok).toBe(false);
    if (!invalidMapping.ok) {
      expect(invalidMapping.errors.map(error => error.code))
        .toContain('INVALID_REQUIREMENT_MAPPING');
    }
  });

  it('어떤 requirement에도 매핑되지 않은 Done Criterion을 거부', () => {
    const orphaned = canonicalSpec.replace('| REQ-example-002 | Tests remain valid | D2 |\n', '');
    expect(compileExecutionPacket(input({ canonicalSpec: orphaned })))
      .toMatchObject({
        ok: false,
        errors: [{ code: 'INVALID_REQUIREMENT_MAPPING', sourceId: 'D2' }],
      });
  });

  it('Done Criteria 밖의 D 행은 계약 기준으로 인정하지 않음', () => {
    const misplaced = canonicalSpec.replace('## Done Criteria', '## Unrelated Table');
    expect(compileExecutionPacket(input({ canonicalSpec: misplaced }))).toEqual({
      ok: false,
      errors: [{ code: 'MISSING_DONE_CRITERIA', message: 'No contract criteria found' }],
    });
  });

  it('profile 필수 Constraints 섹션 누락을 차단', () => {
    const withoutConstraints = canonicalSpec.replace(
      /## Constraints[\s\S]*?(?=## Done Criteria)/,
      '',
    );
    const result = compileExecutionPacket(input({ canonicalSpec: withoutConstraints }));

    expect(result).toEqual({
      ok: false,
      errors: [{
        code: 'MISSING_REQUIRED_SECTION',
        message: 'Constraints section is required',
      }],
    });
  });

  it('지원하지 않는 runtime profile을 구조화된 오류로 거부', () => {
    const result = Reflect.apply(compileExecutionPacket, undefined, [{
      ...input(),
      profile: 'unknown',
    }]);
    expect(result).toEqual({
      ok: false,
      errors: [{ code: 'INVALID_PROFILE', message: 'Unsupported profile: unknown' }],
    });
  });

  it('반환 packet 변경이 다음 컴파일의 profile 결정성을 오염시키지 않음', () => {
    const first = compileExecutionPacket(input());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    first.packet.isolationPolicy.reloadPerScenario = false;

    const second = compileExecutionPacket(input());
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.packet.isolationPolicy.reloadPerScenario).toBe(true);
  });

  it('context budget 초과는 문자열 절단 없이 구조화된 오류를 반환', () => {
    const oversizedConstraint = `- ${'x'.repeat(25_000)}`;
    const oversizedSpec = canonicalSpec.replace(
      '- Do not expose secrets',
      `- Do not expose secrets\n${oversizedConstraint}`,
    );
    const result = compileExecutionPacket(input({ canonicalSpec: oversizedSpec }));

    expect(result).toEqual({
      ok: false,
      errors: [{
        code: 'BUDGET_EXCEEDED',
        message: 'Packet exceeds 24000 characters',
      }],
    });
    expect(result).not.toHaveProperty('packet');
  });

  it('packet 파일을 원자 기록하고 원본 SPEC 변경 시 stale로 판정', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packet-'));
    const specPath = '.vibe/specs/example.md';
    const absoluteSpecPath = path.join(projectPath, specPath);
    fs.mkdirSync(path.dirname(absoluteSpecPath), { recursive: true });
    fs.writeFileSync(absoluteSpecPath, canonicalSpec);

    try {
      const written = writeExecutionPacket({ projectPath, specPath, profile: 'codex' });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      expect(written.packetPath).toBe('.vibe/packets/example/codex.json');
      expect(fs.existsSync(path.join(projectPath, written.packetPath))).toBe(true);
      expect(validateExecutionPacket({
        projectPath,
        specPath,
        packetPath: written.packetPath,
      })).toMatchObject({ valid: true });

      fs.appendFileSync(absoluteSpecPath, '\n<!-- changed -->\n');
      expect(validateExecutionPacket({
        projectPath,
        specPath,
        packetPath: written.packetPath,
      })).toEqual({
        valid: false,
        code: 'STALE_PACKET',
        message: 'Execution packet does not match the current canonical SPEC',
      });
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it('packet 디렉터리의 symbolic link를 통한 project 외부 쓰기를 거부', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packet-project-'));
    const outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packet-outside-'));
    const specPath = '.vibe/specs/example.md';
    const absoluteSpecPath = path.join(projectPath, specPath);
    fs.mkdirSync(path.dirname(absoluteSpecPath), { recursive: true });
    fs.writeFileSync(absoluteSpecPath, canonicalSpec);
    fs.symlinkSync(outsidePath, path.join(projectPath, '.vibe', 'packets'));

    try {
      expect(writeExecutionPacket({ projectPath, specPath, profile: 'codex' }))
        .toEqual({
          ok: false,
          errors: [{
            code: 'INVALID_PATH',
            message: 'Execution packet path contains a symbolic link',
          }],
        });
      expect(fs.readdirSync(outsidePath)).toEqual([]);
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
      fs.rmSync(outsidePath, { recursive: true, force: true });
    }
  });

  it('packet identity가 요청 SPEC과 다르거나 허용 경로 밖이면 거부', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packet-identity-'));
    const specPath = '.vibe/specs/example.md';
    const absoluteSpecPath = path.join(projectPath, specPath);
    fs.mkdirSync(path.dirname(absoluteSpecPath), { recursive: true });
    fs.writeFileSync(absoluteSpecPath, canonicalSpec);

    try {
      const written = writeExecutionPacket({ projectPath, specPath, profile: 'codex' });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      expect(validateExecutionPacket({
        projectPath,
        specPath: '.vibe/specs/different.md',
        packetPath: written.packetPath,
      })).toMatchObject({ valid: false, code: 'INVALID_PACKET' });
      expect(validateExecutionPacket({
        projectPath,
        specPath,
        packetPath: '.vibe/specs/example.md',
      })).toMatchObject({ valid: false, code: 'INVALID_PACKET' });
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it('저장된 packet 계약 본문 변조를 canonical 재컴파일로 거부', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packet-tamper-'));
    const specPath = '.vibe/specs/example.md';
    const absoluteSpecPath = path.join(projectPath, specPath);
    fs.mkdirSync(path.dirname(absoluteSpecPath), { recursive: true });
    fs.writeFileSync(absoluteSpecPath, canonicalSpec);

    try {
      const written = writeExecutionPacket({ projectPath, specPath, profile: 'codex' });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      const packetFile = path.join(projectPath, written.packetPath);
      fs.writeFileSync(packetFile, JSON.stringify({ ...written.packet, constraints: [] }));
      expect(validateExecutionPacket({
        projectPath,
        specPath,
        packetPath: written.packetPath,
      })).toMatchObject({ valid: false, code: 'INVALID_PACKET' });
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it('호출자가 승인하지 않은 requirement subset packet을 거부', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-packet-subset-'));
    const specPath = '.vibe/specs/example.md';
    const absoluteSpecPath = path.join(projectPath, specPath);
    fs.mkdirSync(path.dirname(absoluteSpecPath), { recursive: true });
    fs.writeFileSync(absoluteSpecPath, canonicalSpec);

    try {
      const written = writeExecutionPacket({
        projectPath,
        specPath,
        profile: 'codex',
        selectedRequirementIds: ['REQ-example-001'],
      });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      expect(validateExecutionPacket({
        projectPath,
        specPath,
        packetPath: written.packetPath,
      })).toMatchObject({ valid: false, code: 'INVALID_PACKET' });
      expect(validateExecutionPacket({
        projectPath,
        specPath,
        packetPath: written.packetPath,
        selectedRequirementIds: ['REQ-example-001'],
      })).toEqual({ valid: true });
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it('symbolic link SPEC을 통한 project 외부 읽기를 거부', () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-spec-project-'));
    const outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-spec-outside-'));
    const specPath = '.vibe/specs/example.md';
    const outsideSpec = path.join(outsidePath, 'example.md');
    fs.mkdirSync(path.join(projectPath, '.vibe', 'specs'), { recursive: true });
    fs.writeFileSync(outsideSpec, canonicalSpec);
    fs.symlinkSync(outsideSpec, path.join(projectPath, specPath));

    try {
      expect(writeExecutionPacket({ projectPath, specPath, profile: 'codex' }))
        .toMatchObject({ ok: false, errors: [{ code: 'INVALID_PATH' }] });
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
      fs.rmSync(outsidePath, { recursive: true, force: true });
    }
  });

  it('vibe.run 계약은 packet 생성과 stale 거부를 명시', () => {
    const skill = fs.readFileSync(
      path.join(process.cwd(), 'skills', 'vibe.run', 'SKILL.md'),
      'utf-8',
    );
    expect(skill).toContain('writeExecutionPacket');
    expect(skill).toContain('validateExecutionPacket');
    expect(skill).toContain('STALE_PACKET');
  });
});
