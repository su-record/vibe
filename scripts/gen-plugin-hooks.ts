/**
 * 플러그인용 훅 정의를 `hooks/hooks.json` 에서 생성한다.
 *
 * 훅 정의가 세 벌이라는 게 이 파일이 존재하는 이유다:
 *
 *   hooks/hooks.json                npm 경로 — postinstall 이 `{{VIBE_PATH}}` 를 치환
 *   hooks/plugin-hooks.json         Codex 플러그인 — `${PLUGIN_ROOT}`
 *   hooks/claude-plugin-hooks.json  Claude Code 플러그인 — `${CLAUDE_PLUGIN_ROOT}`
 *
 * 손으로 맞추면 갈라진다. 갈라지면 한쪽 하네스에서만 게이트가 죽고, 그건 조용히
 * 일어난다. 그래서 npm 쪽 하나만 SSOT 로 두고 나머지는 생성한다.
 *
 * 플러그인 쪽 커맨드는 `plugin-hook-entry.js` 를 한 겹 거친다 — npm 설치본과 동시에
 * 설치되면 같은 훅이 두 번 도는 것을 막기 위해서다(실측: 이벤트 6개가 두 벌 등록).
 *
 * `--check` 로 실행하면 쓰지 않고 드리프트만 보고한다(CI 게이트).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'hooks', 'hooks.json');
const NPM_TOKEN = '{{VIBE_PATH}}';
const ENTRY = 'plugin-hook-entry.js';

interface Variant { file: string; token: string; comment: string }

const VARIANTS: Variant[] = [
  {
    file: 'plugin-hooks.json',
    token: '${PLUGIN_ROOT}',
    comment: 'Codex 플러그인용 훅 정의. hooks/hooks.json 에서 생성된다 (scripts/gen-plugin-hooks.ts)'
      + ' — 손으로 고치지 말 것. npm 경로는 postinstall 이 {{VIBE_PATH}} 를 치환하지만 플러그인은'
      + ' 치환 단계가 없어 런타임 변수 ${PLUGIN_ROOT} 를 쓴다. 커맨드가 plugin-hook-entry.js 를'
      + ' 거치는 이유는 npm 설치본과 겹칠 때 같은 훅이 두 번 도는 것을 막기 위해서다.',
  },
  {
    file: 'claude-plugin-hooks.json',
    token: '${CLAUDE_PLUGIN_ROOT}',
    comment: 'Claude Code 플러그인용 훅 정의. hooks/hooks.json 에서 생성된다'
      + ' (scripts/gen-plugin-hooks.ts) — 손으로 고치지 말 것. Claude Code 가 주입하는'
      + ' ${CLAUDE_PLUGIN_ROOT} 를 쓰며, plugin-hook-entry.js 를 거쳐 npm 설치본과의'
      + ' 이중 실행을 막는다.',
  },
];

/** `node {{VIBE_PATH}}/hooks/scripts/x.js a b` → `node <root>/hooks/scripts/plugin-hook-entry.js x.js a b` */
function rewriteCommand(command: string, token: string): string {
  const prefix = `${NPM_TOKEN}/hooks/scripts/`;
  const at = command.indexOf(prefix);
  if (at === -1) return command.split(NPM_TOKEN).join(token);

  const head = command.slice(0, at);
  const tail = command.slice(at + prefix.length);
  return `${head}${token}/hooks/scripts/${ENTRY} ${tail}`;
}

function build(hooks: unknown, token: string): unknown {
  if (Array.isArray(hooks)) return hooks.map((h) => build(h, token));
  if (hooks && typeof hooks === 'object') {
    return Object.fromEntries(
      Object.entries(hooks as Record<string, unknown>).map(([k, v]) =>
        [k, k === 'command' && typeof v === 'string' ? rewriteCommand(v, token) : build(v, token)]),
    );
  }
  return hooks;
}

function main(): void {
  const check = process.argv.includes('--check');
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf-8')) as { hooks: unknown };
  const stale: string[] = [];

  for (const { file, token, comment } of VARIANTS) {
    const target = path.join(ROOT, 'hooks', file);
    const next = JSON.stringify({ _comment: comment, hooks: build(source.hooks, token) }, null, 2) + '\n';
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';

    if (current === next) continue;
    if (check) { stale.push(file); continue; }
    fs.writeFileSync(target, next);
    console.log(`generated hooks/${file}`);
  }

  if (check) {
    if (stale.length > 0) {
      console.error(`STALE: ${stale.join(', ')} — run: npm run gen:plugin-hooks`);
      process.exit(1);
    }
    console.log('FRESH: plugin hook definitions are in sync.');
  }
}

main();
