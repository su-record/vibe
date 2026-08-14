/**
 * 플러그인 매니페스트 버전을 package.json 에 맞춘다.
 *
 * `npm|pnpm version` 은 package.json 만 올린다. vibe 는 npm·Codex 플러그인·Claude Code
 * 플러그인 세 경로로 배포되므로 매니페스트가 뒤처지면 설치본 버전이 어긋난다 —
 * 실제로 3.2.26 범프에서 매니페스트가 3.2.25 로 남아 plugin-manifest.test 가 잡았다.
 *
 * package.json 의 `version` 라이프사이클 훅으로 실행돼 범프 커밋에 함께 담긴다.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFESTS = [
  path.join(ROOT, '.codex-plugin', 'plugin.json'),
  path.join(ROOT, '.claude-plugin', 'plugin.json'),
];

function main(): void {
  const pkgVersion = (
    JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as { version: string }
  ).version;

  for (const file of MANIFESTS) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf-8')) as { version: string };
    const name = path.relative(ROOT, file);

    if (manifest.version === pkgVersion) {
      console.log(`${name} already at ${pkgVersion}`);
      continue;
    }

    const previous = manifest.version;
    manifest.version = pkgVersion;
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`${name} ${previous} → ${pkgVersion}`);
  }
}

main();
