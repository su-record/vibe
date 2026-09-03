/**
 * 플러그인 배포 트리를 `plugins/vibe/` 에 조립한다 — Claude Code · Codex 공용.
 *
 * 왜 별도 트리인가: 마켓플레이스 `source` 가 가리키는 디렉토리를 하네스가 **통째로**
 * 캐시에 복사한다. 저장소 루트를 그대로 가리켰더니 655MB 가 복사됐고 그중 620MB 가
 * `node_modules` 였다(실측).
 *
 * 왜 커밋하는가: Claude Code 마켓플레이스는 저장소를 **클론**해서 읽는다. `dist/` 는
 * gitignore 대상이라 클론에는 없고, `agents/*.md` 는 frontmatter 가 postinstall 에서
 * 생성되므로 클론에는 맨몸이다. 즉 "저장소를 그대로 플러그인으로" 는 기능이 빠진
 * 플러그인이 된다(실측: 에이전트 11개 중 7개만, 그나마 description 없이 로드).
 * 공식 마켓플레이스도 같은 형태다 — 산출물을 커밋하고 드리프트를 CI 로 막는다.
 *
 * 담을 목록은 **`package.json` 의 `files` 를 그대로 쓴다** — "무엇이 배포되는가" 의
 * SSOT 를 두 벌로 만들지 않기 위함이다. npm tarball 과 플러그인이 같은 내용을 담는다.
 */
import fs from 'fs';
import path from 'path';
import { convertAgentToClaude } from '../src/cli/postinstall/claude-agents.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'plugins', 'vibe');

interface Pkg { files: string[] }

/** `files` 항목 → 실제 복사 대상. 부정 패턴(`!…`)은 제외 목록으로 뺀다. */
/**
 * npm 에는 실리지만 플러그인 트리에는 굽지 않는 항목.
 * `skills-extra/` 는 capability 옵트인 설치가 npm 설치본에서 복사하므로 tarball 에 필요하지만,
 * 마켓플레이스 사용자가 받는 것은 코딩 루프(코어 + 스택)뿐이다 — 이름의 SSOT 는
 * src/cli/postinstall/constants.ts SKILL_ROOTS (SPEC skill-tier-boundary).
 */
const PLUGIN_EXCLUDED_ENTRIES: ReadonlyArray<string> = ['skills-extra'];

function resolveEntries(files: string[]): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const raw of files) {
    const entry = raw.replace(/\/$/, '');
    if (entry.startsWith('!')) exclude.push(entry.slice(1));
    else include.push(entry);
  }
  return { include, exclude };
}

function copyRecursive(src: string, dest: string, exclude: string[]): void {
  const rel = path.relative(ROOT, src).replace(/\\/g, '/');
  if (exclude.some((ex) => rel === ex || rel.startsWith(`${ex}/`))) return;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name), exclude);
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * 에이전트를 frontmatter 를 구워 **평면으로** 다시 쓴다.
 *
 * 평면화하는 이유: Claude Code 는 `agents/*.md` 만 스캔한다. `agents/ui/`·`agents/event/`
 * 에 있던 4개가 경고도 없이 사라졌다(실측 — 11개 중 7개만 로드). `teams/` 는 단일
 * 서브에이전트가 아니라 다중 에이전트 메타 문서라 postinstall 과 같은 기준으로 뺀다.
 */
function bakeAgents(outAgents: string): number {
  // 지우기 **전에** 내용을 다 읽는다 — 경로만 모아두고 지우면 읽을 대상이 사라진다
  const agents: Array<{ name: string; content: string }> = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (rel === '' && entry.name === 'teams') continue;
        walk(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.md')) {
        agents.push({
          name: entry.name,
          content: fs.readFileSync(path.join(dir, entry.name), 'utf-8'),
        });
      }
    }
  };
  walk(outAgents, '');

  const collisions = agents.length - new Set(agents.map((a) => a.name)).size;
  if (collisions > 0) {
    throw new Error(`평면화 중 이름 충돌 ${collisions}건 — 서로 다른 에이전트가 덮어써진다`);
  }

  fs.rmSync(outAgents, { recursive: true, force: true });
  fs.mkdirSync(outAgents, { recursive: true });

  for (const { name, content } of agents) {
    fs.writeFileSync(path.join(outAgents, name), convertAgentToClaude(content, name), 'utf-8');
  }
  return agents.length;
}

function main(): void {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as Pkg;
  const { include, exclude } = resolveEntries(pkg.files);
  const pluginInclude = include.filter((entry) => !PLUGIN_EXCLUDED_ENTRIES.includes(entry));

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const copied: string[] = [];
  for (const entry of pluginInclude) {
    const src = path.join(ROOT, entry);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(OUT, entry), exclude);
    copied.push(entry);
  }

  const agents = bakeAgents(path.join(OUT, 'agents'));

  // 매니페스트가 없으면 플러그인으로 인식되지 않는다 — 조립 실패를 조용히 넘기지 않는다
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    if (!fs.existsSync(path.join(OUT, manifest))) {
      throw new Error(`플러그인 매니페스트가 조립되지 않았다: ${path.join(OUT, manifest)}`);
    }
  }

  console.log(
    `plugin built → plugins/vibe (${copied.length} entries, ${agents} agents baked flat)`,
  );
}

main();
