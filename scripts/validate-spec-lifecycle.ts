/**
 * SPEC lifecycle 게이트 — `.vibe/specs/**` 전수를 판정한다.
 *
 * ## 왜 필요한가
 *
 * SPEC 은 VERIFIED 로 확정된 뒤에도 코드가 움직이면 그대로 남는다. 문서는 스스로
 * 늙지 않으므로 Status 표기만으로는 썩음을 잡지 못한다 — 그래서 두 가지를 강제한다:
 * 헤더 값의 **닫힌 집합**(무엇이 통과인지 정의 가능해야 한다)과, 코드에 안착하는
 * SPEC 의 **Anchors 경로 실재**(경로가 사라지면 여기서 빨간불이 켜진다).
 *
 * 실측(2026-09-02): 29개 SPEC 중 20개에 Status 줄이 없었고, 나머지 9개의 값은
 * 5가지 표기로 갈라져 있었다. 게이트가 없으면 선언과 실물은 조용히 어긋난다 —
 * dsh 도 게이트 없는 코드블록 하나에서 정확히 그렇게 무너졌다.
 *
 * ## 판정의 소유권
 *
 * 닫힌 집합과 헤더 파싱은 `src/tools/spec/specLifecycle.ts` 가 소유한다. 이 스크립트는
 * 그것을 import 해서 파일시스템에 적용할 뿐이다 — 상수를 여기 복사하면 그 순간 두 벌이 된다.
 * 반대로 경로 존재 검사는 여기에만 있다: 모듈은 CWD 와 무관한 순수 함수로 남긴다.
 *
 * ## Anchors 표기
 *
 * 리터럴 경로만 인정한다 (파일 또는 디렉토리, 저장소 루트 기준). 글롭을 허용하면
 * "0개 매치" 를 통과로 볼지 실패로 볼지가 표기마다 갈리고, 게이트가 판정을 잃는다.
 * 뒤에 붙는 줄 범위(`foo.ts:120-140`)는 떼고 파일만 본다 — 줄 번호는 편집마다 어긋나서
 * 게이트를 상시 빨간불로 만들고, 그러면 아무도 읽지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { checkSpecLifecycle, parseSpecLifecycle, isLifecycleExempt } from '../src/tools/spec/specLifecycle.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SPECS = path.join(ROOT, '.vibe', 'specs');

function collectSpecs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSpecs(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

/** Anchors 에 적힌 경로가 실재하는가 — 이것이 "썩은 SPEC" 을 잡는 유일한 신호다 */
function deadAnchors(content: string, specFile: string): string[] {
  if (isLifecycleExempt(specFile)) return [];
  const { anchors } = parseSpecLifecycle(content);
  if (!anchors) return [];
  const paths = new Set(anchors.map((a) => a.replace(/:\d+(-\d+)?$/, '')).filter((a) => a.length > 0));
  return [...paths].filter((a) => !fs.existsSync(path.join(ROOT, a)));
}

function main(): void {
  const files = collectSpecs(SPECS);
  const failures: string[] = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const content = fs.readFileSync(file, 'utf-8');

    for (const f of checkSpecLifecycle(content, rel)) failures.push(`${rel} — ${f.message}`);
    for (const a of deadAnchors(content, rel)) {
      failures.push(`${rel} — Anchor 경로가 없다: ${a} (코드가 움직였는데 SPEC 이 따라오지 않았다)`);
    }
  }

  if (failures.length > 0) {
    console.error(`ROTTEN: ${failures.length} lifecycle violation(s) in ${files.length} SPEC file(s)`);
    for (const f of failures) console.error(`  ${f}`);
    console.error('헤더는 vibe/templates/spec-template.md 를, 닫힌 집합은 src/tools/spec/specLifecycle.ts 를 따른다.');
    process.exit(1);
  }

  console.log(`FRESH: ${files.length} SPEC files pass the lifecycle gate.`);
}

main();
