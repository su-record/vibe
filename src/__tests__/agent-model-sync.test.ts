import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

/**
 * 모델 할당 SSOT 가드 — agents/(**)/*.md 의 `## Model` 섹션이
 * src/cli/postinstall/constants.ts > CLAUDE_MODEL_MAPPING 과 일치하는지 검증한다.
 *
 * 이 매핑이 유일 SSOT 다(postinstall 이 이 값을 설치 시 frontmatter `model:` 로 주입).
 * 문서 본문에 손으로 박은 모델명이 드리프트하면 CI 에서 여기서 실패한다.
 * 자동 정렬: `npm run sync:agent-models`.
 *
 * NOTE: 재작성 로직은 scripts/sync-agent-models.ts 에 있지만, tsconfig rootDir=src
 * 때문에 여기서 import 하지 않고 불변식을 순수 fs 로 독립 검증한다(동일 SSOT 참조).
 */

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(ROOT, 'agents');
const CONSTANTS_FILE = path.join(ROOT, 'src', 'cli', 'postinstall', 'constants.ts');

const DISPLAY: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  inherit: 'Inherit',
};

function loadModelMapping(): Record<string, string> {
  const content = fs.readFileSync(CONSTANTS_FILE, 'utf-8');
  const block = content.match(/CLAUDE_MODEL_MAPPING[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('CLAUDE_MODEL_MAPPING not found in constants.ts');
  const map: Record<string, string> = {};
  for (const m of block[1].matchAll(/'([\w-]+)':\s*'([\w-]+)'/g)) map[m[1]] = m[2];
  return map;
}

/** `## Model` 섹션의 첫 모델 라인 (`**Model** ...`) 을 반환 */
function firstModelLine(content: string): string | null {
  const lines = content.split('\n');
  const h = lines.findIndex((l) => /^##\s+Model\s*$/.test(l));
  if (h === -1) return null;
  for (let i = h + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    if (/^\s*\*\*(Haiku|Sonnet|Opus|Inherit)/.test(lines[i])) return lines[i].trim();
  }
  return null;
}

describe('agent model SSOT (CLAUDE_MODEL_MAPPING)', () => {
  const map = loadModelMapping();
  const files = globSync('**/*.md', { cwd: AGENTS_DIR }).sort();

  it('discovers agent files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const rel of files) {
    const name = path.basename(rel, '.md');

    it(`${rel} has a CLAUDE_MODEL_MAPPING entry`, () => {
      expect(map[name], `no model mapping for "${name}"`).toBeDefined();
    });

    it(`${rel} '## Model' matches the mapped tier (no drift, no version)`, () => {
      const tier = map[name];
      if (!tier) return; // covered by the entry test above
      const content = fs.readFileSync(path.join(AGENTS_DIR, rel), 'utf-8');
      const line = firstModelLine(content);
      expect(line, `missing '## Model' section in ${rel}`).not.toBeNull();
      // 매핑 tier 와 표기가 일치해야 하고, 버전 숫자(예: "Haiku 4.5")가 없어야 한다.
      expect(line).toMatch(new RegExp(`^\\*\\*${DISPLAY[tier]}\\*\\*`));
      expect(line, `version-pinned model name in ${rel}`).not.toMatch(/\*\*(Haiku|Sonnet|Opus)\s+[\d.]/);
    });
  }
});
