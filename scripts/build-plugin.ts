/**
 * 플러그인 배포 트리를 `plugins/vibe/` 에 조립한다.
 *
 * 왜 필요한가: 마켓플레이스 `source.path` 가 가리키는 디렉토리를 Codex 가 **통째로**
 * 캐시에 복사한다. 저장소 루트를 그대로 가리켰더니 655MB 가 복사됐고 그중 620MB 가
 * `node_modules` 였다(실측). 실제 플러그인(예: openai-curated 의 linear)은
 * `skills/` · `assets/` 만 담은 최소 디렉토리다.
 *
 * 담을 목록은 **`package.json` 의 `files` 를 그대로 쓴다** — "무엇이 배포되는가" 의
 * SSOT 를 두 벌로 만들지 않기 위함이다. npm tarball 과 플러그인이 같은 내용을 담는다.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'plugins', 'vibe');

interface Pkg { files: string[] }

/** `files` 항목 → 실제 복사 대상. 부정 패턴(`!…`)은 제외 목록으로 뺀다. */
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

function main(): void {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as Pkg;
  const { include, exclude } = resolveEntries(pkg.files);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const copied: string[] = [];
  for (const entry of include) {
    const src = path.join(ROOT, entry);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(OUT, entry), exclude);
    copied.push(entry);
  }

  // 매니페스트가 없으면 플러그인으로 인식되지 않는다 — 조립 실패를 조용히 넘기지 않는다
  const manifest = path.join(OUT, '.codex-plugin', 'plugin.json');
  if (!fs.existsSync(manifest)) {
    throw new Error(`플러그인 매니페스트가 조립되지 않았다: ${manifest}`);
  }

  console.log(`plugin built → plugins/vibe (${copied.length} entries: ${copied.join(', ')})`);
}

main();
