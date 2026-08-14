/**
 * 에이전트 frontmatter 는 **파싱되어야** 의미가 있다.
 *
 * 실측한 사건: description 에 `: ` 가 들어간 에이전트 4개(`code-reviewer`,
 * `e2e-tester`, `event-ops`, `security-reviewer`)의 frontmatter 가 통째로 파싱에
 * 실패하고 있었다. YAML 평문 스칼라에서 `: ` 는 매핑 구분자라 그 줄에서 문서가
 * 깨진다. 결과는 에러가 아니라 **침묵** — name·model·tools·permissionMode 가 전부
 * 버려진 채 로드된다. `claude plugin validate` 가 잡아주기 전까지 아무도 몰랐다.
 *
 * 그래서 "frontmatter 를 썼다" 가 아니라 "파싱된다" 를 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { convertAgentToClaude } from './claude-agents.js';

/** frontmatter 블록만 떼어 최소 파싱 — 값에 `: ` 가 있어도 키가 하나로 잡혀야 한다 */
function parseFrontmatter(md: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) throw new Error('frontmatter 블록이 없다');

  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const at = line.indexOf(': ');
    if (at === -1) throw new Error(`키:값 으로 읽히지 않는 줄 — ${line}`);
    const value = line.slice(at + 2);
    // 따옴표로 감싸이지 않았는데 값에 `: ` 가 또 있으면 YAML 은 매핑으로 읽고 깨진다
    if (!/^["'].*["']$/.test(value) && value.includes(': ')) {
      throw new Error(`따옴표 없는 값에 ': ' — YAML 이 매핑으로 해석한다: ${line}`);
    }
    out[line.slice(0, at)] = value.replace(/^"(.*)"$/, '$1');
  }
  return out;
}

const body = (role: string): string => `# Code Reviewer\n\n## Role\n\n- ${role}\n\n## Notes\n\nx\n`;

describe('convertAgentToClaude', () => {
  it('description 에 ": " 가 있어도 frontmatter 가 깨지지 않는다', () => {
    const md = convertAgentToClaude(body('caller passes focus: correctness, security'), 'code-reviewer.md');
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe('code-reviewer');
    expect(fm.description).toContain('focus: correctness');
  });

  it('필수 키가 모두 남는다 — 하나라도 깨지면 전부 버려진다', () => {
    const fm = parseFrontmatter(convertAgentToClaude(body('entry points: trust boundaries'), 'security-reviewer.md'));
    for (const key of ['name', 'description', 'model', 'tools', 'permissionMode']) {
      expect(fm[key], `${key} 누락`).toBeTruthy();
    }
  });

  it('큰따옴표가 든 description 도 이스케이프한다', () => {
    const md = convertAgentToClaude(body('handles "done" markers: yes'), 'tester.md');
    expect(() => parseFrontmatter(md)).not.toThrow();
    expect(md).toContain('\\"done\\"');
  });

  it('본문은 그대로 보존한다', () => {
    expect(convertAgentToClaude(body('x'), 'tester.md')).toContain('## Notes');
  });

  it('매핑에 없는 에이전트는 세션 모델을 상속한다 — 조용한 다운그레이드 금지', () => {
    expect(parseFrontmatter(convertAgentToClaude(body('x'), 'nonexistent-agent.md')).model)
      .toBe('inherit');
  });
});
