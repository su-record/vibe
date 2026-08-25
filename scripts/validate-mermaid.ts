/**
 * Mermaid 블록 렌더 검증.
 *
 * ## 왜 필요한가
 *
 * "Mermaid 는 GitHub 가 네이티브로 렌더하니 렌더 검증은 해당 없다" 고 판단했다가
 * 틀렸다. 플랫폼 렌더링이 없애주는 것은 **레이아웃·CSS 실패**(잘림, 겹침)이지
 * **문법 실패**가 아니다. 문법이 깨진 블록은 그림 대신 에러 박스로 렌더된다 —
 * 즉 리뷰 표면이 조용히 죽는다. 구조 다이어그램을 승인 게이트에 놓은 이유가
 * "산문이 숨기는 것을 그림이 드러낸다" 였는데, 그 그림이 안 그려지면 전제가 무너진다.
 *
 * ## 왜 실제 파서를 쓰는가
 *
 * 정규식으로 문법을 흉내내면 이 저장소가 반복해서 밟은 함정(리터럴에 의존하다
 * 규격이 바뀌면 조용히 통과)에 그대로 빠진다. mermaid 는 DOM 을 요구하므로
 * jsdom 을 얹어 헤드리스로 파싱한다 — 둘 다 devDependency 라 사용자에게 나가지 않는다.
 *
 * ## 건너뛰는 것
 *
 * 템플릿의 자리표시자 블록(`{노드와 간선 …}`)은 의도적으로 Mermaid 가 아니다.
 * 채워 넣을 자리이므로 검사 대상에서 뺀다 — 검사하면 템플릿이 영원히 빨간불이 된다.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(import.meta.dirname, '..');

interface Block { file: string; line: number; source: string }

/** 자리표시자 — 채워 넣을 자리는 문법 검사 대상이 아니다 */
const PLACEHOLDER = /\{[^}\n]*\}/;

function collectBlocks(): Block[] {
  const files = execSync('git ls-files "*.md"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n')
    .filter((f) => f && !f.startsWith('plugins/'));   // 배포 트리는 소스의 복사본이다

  const blocks: Block[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf-8').split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (start === -1 && /^\s*```mermaid\s*$/.test(lines[i])) { start = i; continue; }
      if (start !== -1 && /^\s*```\s*$/.test(lines[i])) {
        blocks.push({ file, line: start + 1, source: lines.slice(start + 1, i).join('\n') });
        start = -1;
      }
    }
  }
  return blocks;
}

async function main(): Promise<void> {
  const blocks = collectBlocks();
  const checked = blocks.filter((b) => !PLACEHOLDER.test(b.source));
  const skipped = blocks.length - checked.length;

  if (checked.length === 0) {
    console.log(`FRESH: no mermaid blocks to check (${skipped} placeholder blocks skipped).`);
    return;
  }

  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  (globalThis as unknown as { window: unknown }).window = dom.window;
  (globalThis as unknown as { document: unknown }).document = dom.window.document;

  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false });

  const failures: string[] = [];
  for (const b of checked) {
    try {
      await mermaid.parse(b.source);
    } catch (e) {
      const reason = String((e as Error).message).split('\n')[0];
      failures.push(`${b.file}:${b.line} — ${reason}`);
    }
  }

  if (failures.length > 0) {
    console.error(`BROKEN: ${failures.length} mermaid block(s) fail to render`);
    for (const f of failures) console.error(`  ${f}`);
    console.error('그림이 안 그려지면 리뷰 표면이 죽는다 — 승인 전에 고친다.');
    process.exit(1);
  }

  console.log(
    `FRESH: ${checked.length} mermaid blocks parse`
    + (skipped > 0 ? ` (${skipped} placeholder blocks skipped).` : '.'),
  );
}

await main();
