/**
 * `vibe plugin` — npm 으로 설치한 사용자가 vibe 를 플러그인으로 쓰게 한다.
 *
 * 왜 필요한가: 플러그인 설치 경로를 저장소 기준으로만 만들었더니, `npm i -g` 사용자는
 * 쓸 방법이 없었다 — 저장소를 클론하지 않으니 `npm run build:plugin` 도
 * `.agents/plugins/marketplace.json` 도 없다.
 *
 * 전역 설치본을 마켓플레이스로 직접 가리키는 것도 안 된다. Codex 는 `source.path`
 * 디렉토리를 **통째로** 캐시에 복사하는데, 전역 패키지는 312MB 중 304MB 가
 * `node_modules` 다(실측). 그래서 배포에 필요한 것만 골라 별도 트리로 조립한다.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { log } from '../utils.js';
import { getCoreConfigDir } from '../setup/GlobalInstaller.js';
import { convertAgentToClaude } from '../postinstall/claude-agents.js';

/** 조립 대상 — package.json `files` 와 같은 목록을 쓴다 (배포 내용의 SSOT) */
const PLUGIN_ENTRIES = [
  '.codex-plugin', '.claude-plugin', 'dist', 'vibe', 'languages', 'agents', 'skills', 'hooks',
  'CLAUDE.md', 'README.md', 'LICENSE',
] as const;

/** 조립본에 넣지 않는다 — 테스트와 의존성은 플러그인 런타임에 불필요하다 */
const SKIP = new Set(['node_modules', '__tests__']);

function pluginTreeDir(): string {
  return path.join(getCoreConfigDir(), 'plugin', 'vibe');
}

/** Claude Code 마켓플레이스 — 플러그인 트리의 **부모**에 둔다 (source 가 `./vibe`) */
function claudeMarketplacePath(): string {
  return path.join(pluginTreeDir(), '..', '.claude-plugin', 'marketplace.json');
}

function marketplacePath(): string {
  return path.join(marketplaceRoot(), '.agents', 'plugins', 'marketplace.json');
}

/** 마켓플레이스 루트 — `.agents/` 를 담고 있는 디렉토리. `codex plugin marketplace add` 의 인자다. */
function marketplaceRoot(): string {
  return os.homedir();
}

/** 설치된 vibe 패키지 루트 — 이 파일 기준으로 거슬러 올라간다 */
function packageRoot(): string {
  return path.resolve(import.meta.dirname, '..', '..', '..');
}

function copyRecursive(src: string, dest: string): void {
  if (SKIP.has(path.basename(src))) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * 개인 마켓플레이스에 vibe 항목을 병합한다 — 기존 항목은 보존한다.
 *
 * `source.path` 는 **마켓플레이스 루트 기준 `./` 상대 경로**여야 한다. 절대 경로를
 * 넣으면 등록은 되지만 `plugin add` 가 "not found in marketplace" 로 실패한다(실측).
 * 루트는 `.agents/` 를 담고 있는 디렉토리, 즉 홈이다.
 */
function writeMarketplace(pluginDir: string): string {
  const file = marketplacePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let doc: { name?: string; interface?: unknown; plugins?: Array<{ name?: string }> } = {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      doc = parsed as typeof doc;
    }
  } catch { /* 없거나 손상 → 새로 만든다 */ }

  doc.name ??= 'vibe';
  doc.interface ??= { displayName: 'Vibe' };
  const plugins = Array.isArray(doc.plugins) ? doc.plugins : [];

  const entry = {
    name: 'vibe',
    source: { source: 'local', path: `./${path.relative(marketplaceRoot(), pluginDir).replace(/\\/g, '/')}` },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: 'Developer Tools',
  };
  const idx = plugins.findIndex((p) => p?.name === 'vibe');
  if (idx === -1) plugins.push(entry);
  else plugins[idx] = entry;
  doc.plugins = plugins;

  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  return file;
}

/**
 * Claude Code 마켓플레이스를 쓴다 — 스키마가 Codex 쪽과 다르다.
 *
 * `owner` 는 문자열이 아니라 객체여야 하고(`claude plugin validate` 가 거부한다),
 * `source` 는 마켓플레이스 루트 기준 상대 경로 문자열이다.
 */
function writeClaudeMarketplace(pluginDir: string): string {
  const file = claudeMarketplacePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  fs.writeFileSync(file, JSON.stringify({
    $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
    name: 'vibe',
    description: 'Verification harness for AI coding agents — deterministic gates decide "done".',
    owner: { name: 'su-record', url: 'https://github.com/su-record' },
    plugins: [{
      name: 'vibe',
      displayName: 'Vibe',
      description: 'Natural-language requirement to a SPEC you approve once, then an'
        + ' ANCHOR→ACT→JUDGE→RECORD loop until deterministic gates pass.',
      author: { name: 'su-record' },
      category: 'productivity',
      homepage: 'https://github.com/su-record/vibe',
      source: `./${path.basename(pluginDir)}`,
    }],
  }, null, 2) + '\n');
  return file;
}

/**
 * 에이전트에 frontmatter 를 굽고 평면으로 다시 쓴다.
 *
 * 저장소·npm tarball 의 `agents/*.md` 에는 frontmatter 가 없다 — postinstall 이
 * 설치 시점에 만든다. 플러그인은 그 단계를 거치지 않으므로 여기서 굽지 않으면
 * description·model·tools 없이 로드된다. 평면화는 Claude Code 가 `agents/*.md` 만
 * 스캔하기 때문이다(실측: 하위 디렉토리의 4개가 경고 없이 사라졌다).
 */
function bakeAgents(dir: string): void {
  if (!fs.existsSync(dir)) return;

  const agents: Array<{ name: string; content: string }> = [];
  const walk = (current: string, rel: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (rel === '' && entry.name === 'teams') continue;
        walk(path.join(current, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.md')) {
        agents.push({
          name: entry.name,
          content: fs.readFileSync(path.join(current, entry.name), 'utf-8'),
        });
      }
    }
  };
  walk(dir, '');

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const { name, content } of agents) {
    fs.writeFileSync(path.join(dir, name), convertAgentToClaude(content, name), 'utf-8');
  }
}

/** 플러그인 트리를 조립하고 개인 마켓플레이스에 등록한다 */
export function pluginInstall(): void {
  const root = packageRoot();
  const out = pluginTreeDir();

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const copied: string[] = [];
  for (const entry of PLUGIN_ENTRIES) {
    const src = path.join(root, entry);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(out, entry));
    copied.push(entry);
  }

  if (!fs.existsSync(path.join(out, '.codex-plugin', 'plugin.json'))) {
    console.error(`❌ 플러그인 매니페스트를 찾지 못했습니다 (${root}/.codex-plugin/plugin.json)`);
    console.error('   vibe upgrade 로 전역 자산을 갱신한 뒤 다시 시도하세요.');
    process.exitCode = 1;
    return;
  }

  bakeAgents(path.join(out, 'agents'));
  const file = writeMarketplace(out);
  const claudeFile = writeClaudeMarketplace(out);
  log(`
✅ vibe 플러그인 준비 완료

  플러그인     ${out}
  마켓플레이스 ${file}
               ${claudeFile}
  포함         ${copied.join(', ')}

다음 단계:
  Claude Code  claude plugin marketplace add ${path.dirname(path.dirname(claudeFile))}
               claude plugin install vibe@vibe
  Codex        codex plugin marketplace add ${marketplaceRoot()}
               codex plugin add vibe@vibe
               (훅은 설치만으로 신뢰되지 않습니다 — Codex 가 정의를 검토·승인해야 실행됩니다)
  ChatGPT 앱   앱을 재시작한 뒤 Plugins Directory 에서 Vibe 설치

⚠️  npm 설치본의 프로젝트 훅이 이미 있으면 플러그인 훅은 스스로 물러납니다
    (같은 게이트가 두 번 도는 것을 막습니다).
`);
}


/** 조립 상태와 마켓플레이스 등록 여부를 보고한다 */
export function pluginStatus(): void {
  const out = pluginTreeDir();
  const manifest = path.join(out, '.codex-plugin', 'plugin.json');
  const file = marketplacePath();

  let version = '—';
  try {
    version = (JSON.parse(fs.readFileSync(manifest, 'utf-8')) as { version: string }).version;
  } catch { /* 미설치 */ }

  const registered = (() => {
    try {
      const doc = JSON.parse(fs.readFileSync(file, 'utf-8')) as { plugins?: Array<{ name?: string }> };
      return (doc.plugins ?? []).some((p) => p?.name === 'vibe');
    } catch {
      return false;
    }
  })();

  log(`
Vibe plugin

  트리         ${fs.existsSync(manifest) ? `✅ ${out} (v${version})` : `⬚ 없음 — 'vibe plugin install' 실행`}
  마켓플레이스 ${registered ? `✅ ${file}` : `⬚ 미등록`}
`);
}
