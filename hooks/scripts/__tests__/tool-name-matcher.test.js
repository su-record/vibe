/**
 * 훅 matcher 의 툴 이름 계약.
 *
 * 실측한 사건(2026-08): 서브에이전트 툴이 `Task` → `Agent` 로 바뀌었는데 matcher 는
 * 옛 이름만 갖고 있었다. 결과는 에러가 아니라 **침묵** — step-counter 가 에이전트
 * 스폰을 한 건도 세지 않으면서 계속 0을 보고했다. 세션 로그 60개 실측에서
 * `Agent` 13회 / `Task` 0회, `Skill` 116회 / `SlashCommand` 0회였다.
 *
 * 하네스는 툴 이름을 바꾼다. 그래서 규칙은 한 방향이다:
 *
 *   과다 매칭은 안전하다  — 스크립트가 READ_ONLY_TOOLS 로 걸러낸다
 *   과소 매칭은 위험하다  — 소리 없이 데이터를 잃는다
 *
 * 옛 이름을 지우지 않는 것이 구버전 하네스 호환까지 겸한다. 이 테스트는 그 방향을
 * 고정한다 — 누가 "안 쓰는 이름이니 정리하자" 로 지우는 것을 막는다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

const HOOK_FILES = ['hooks.json', 'plugin-hooks.json', 'claude-plugin-hooks.json'];

/** 액션 툴 집계용 PostToolUse matcher 를 찾는다 (step-counter 가 붙어 있는 그룹) */
const stepCounterMatcher = (file) => {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', file), 'utf-8'));
  const group = (doc.hooks.PostToolUse ?? []).find((g) =>
    (g.hooks ?? []).some((h) => (h.command ?? '').includes('step-counter.js')));
  if (!group) throw new Error(`step-counter 그룹을 찾지 못했다: ${file}`);
  return group.matcher ?? '';
};

/** 현재 이름 → 이 툴이 매칭돼야 하는 이유 */
const CURRENT = {
  Agent: '서브에이전트 스폰 — 가장 비싼 액션이라 빠지면 집계가 무의미해진다',
  Skill: '스킬 호출 — SlashCommand 를 대체했다',
  Edit: '파일 수정',
  Write: '파일 생성',
  Bash: '명령 실행',
};

/** 옛 이름 → 지우지 않는 이유 */
const LEGACY = {
  Task: 'Agent 이전 이름 — 구버전 하네스에서 여전히 쓰인다',
  SlashCommand: 'Skill 이전 이름',
  NotebookEdit: '드물게 쓰이지만 살아 있는 툴 — 미관측을 사망으로 읽지 않는다',
};

describe.each(HOOK_FILES)('%s — step-counter matcher', (file) => {
  const matcher = stepCounterMatcher(file);
  const names = matcher.split('|');

  it.each(Object.entries(CURRENT))('현재 이름 %s 를 매칭한다 (%s)', (name) => {
    expect(names).toContain(name);
  });

  it.each(Object.entries(LEGACY))('옛 이름 %s 를 지우지 않는다 (%s)', (name) => {
    expect(names, '과소 매칭은 소리 없이 데이터를 잃는다 — 옛 이름은 남긴다')
      .toContain(name);
  });

  it('읽기 전용 툴은 matcher 단에서 제외한다 — hot path 에서 프로세스를 띄우지 않는다', () => {
    for (const readOnly of ['Read', 'Grep', 'Glob', 'WebSearch']) {
      expect(names).not.toContain(readOnly);
    }
  });
});

it('세 벌의 matcher 가 같다 — 하네스별로 집계가 갈리면 안 된다', () => {
  const [first, ...rest] = HOOK_FILES.map(stepCounterMatcher);
  for (const m of rest) expect(m).toBe(first);
});
