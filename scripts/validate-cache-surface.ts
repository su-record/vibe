/**
 * 프리픽스 캐시 표면 게이트.
 *
 * `vibe/rules/prefix-cache-surface.md` 가 나열한 자산과 저장소의 실물을 양방향으로 맞춘다.
 * 판정 로직은 `src/tools/docs/cacheSurface.ts` 가 소유하고, 여기서는 실물만 모은다.
 *
 * 나열 대상은 **상시 프리픽스에 실리는 것**뿐이다. 훅은 전부가 아니라 턴 앞단 두 이벤트
 * (SessionStart · UserPromptSubmit) 만 — 나머지는 턴 중간이라 프리픽스를 바꾸지 않는다.
 * 스킬은 개수만 문제이고 그 사실의 집은 `validate:counts` 라 여기서 다시 세지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { checkCacheSurfaceDoc } from '../src/tools/docs/cacheSurface.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC = path.join(ROOT, 'vibe', 'rules', 'prefix-cache-surface.md');

/** 프리픽스에 stdout 이 얹히는 훅 이벤트 */
const PREFIX_EVENTS = ['SessionStart', 'UserPromptSubmit'] as const;

interface HookEntry { command?: string }
interface HookMatcher { hooks?: HookEntry[] }

function prefixHookScripts(): string[] {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf-8')) as {
    hooks?: Record<string, HookMatcher[]>;
  };
  const scripts = PREFIX_EVENTS
    .flatMap((event) => raw.hooks?.[event] ?? [])
    .flatMap((matcher) => matcher.hooks ?? [])
    .map((h) => (h.command ?? '').match(/hooks\/scripts\/[\w.-]+\.js/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[0]);
  return [...new Set(scripts)];
}

function agentFiles(dir: string, prefix: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + entry.name;
    if (entry.isDirectory()) out.push(...agentFiles(path.join(dir, entry.name), rel + '/'));
    else if (entry.name.endsWith('.md')) out.push(rel);
  }
  return out;
}

function main(): void {
  if (!fs.existsSync(DOC)) {
    console.error(`MISSING: ${path.relative(ROOT, DOC)} 이 없다 — 상시 로드 자산의 캐시 영향이 어디에도 적혀 있지 않다.`);
    process.exit(1);
  }

  const actual = {
    'always-loaded-docs': ['CLAUDE.md', 'AGENTS.md'],
    'prefix-hooks': prefixHookScripts(),
    agents: agentFiles(path.join(ROOT, 'agents'), 'agents/'),
  };

  const findings = checkCacheSurfaceDoc(fs.readFileSync(DOC, 'utf-8'), actual);
  if (findings.length > 0) {
    console.error(`DRIFT: ${findings.length} cache-surface violation(s)`);
    for (const f of findings) console.error(`  ${f.message}`);
    console.error('vibe/rules/prefix-cache-surface.md 를 실물에 맞춘다 — 상시 로드 자산의 비용은 매 세션에서 나온다.');
    process.exit(1);
  }

  const counted = Object.values(actual).reduce((n, v) => n + v.length, 0);
  console.log(`FRESH: ${counted} prefix-cache assets documented across ${Object.keys(actual).length} surfaces.`);
}

main();
