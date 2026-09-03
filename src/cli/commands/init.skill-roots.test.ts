/**
 * installLocalSkills — 스택 스킬은 skills/, capability 스킬은 skills-extra/ 에서 복사한다
 * (SPEC skill-tier-boundary, D4). 실제 배송 트리를 임시 프로젝트에 복사해 확인한다.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { installLocalSkills } from './init.js';

let projectRoot: string;
beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-skill-roots-'));
});
afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

function installed(name: string): boolean {
  return fs.existsSync(path.join(projectRoot, '.claude', 'skills', name, 'SKILL.md'));
}

describe('installLocalSkills across skill roots', () => {
  it('REQ-skill-tier-boundary-003 copies a stack skill from skills/ and a capability skill from skills-extra/', () => {
    installLocalSkills(projectRoot, ['typescript-react'], ['education']);

    expect(installed('vibe.figma')).toBe(true);
    expect(installed('vibe.educational-content')).toBe(true);
  });

  it('does not install extras without the matching capability', () => {
    installLocalSkills(projectRoot, ['typescript-react']);

    expect(installed('vibe.figma')).toBe(true);
    expect(installed('vibe.educational-content')).toBe(false);
  });
});
