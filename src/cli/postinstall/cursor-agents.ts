/**
 * Cursor 에이전트 변환 및 설치
 *
 * 통합 리뷰어 2종(code-reviewer, security-reviewer)을 Cursor 서브에이전트로 설치.
 * (구 12종 리뷰어 매트릭스는 harness-review-2026-07-01 P2-1 에서 통합됨 —
 *  survivor 에이전트는 goal+constraints 본문이라 Checklist/Output 섹션 파싱 대신
 *  본문 전체를 그대로 싣는다.)
 */

import path from 'path';
import fs from 'fs';
import { ensureDir } from './fs-utils.js';
import { CURSOR_MODEL_MAPPING } from './constants.js';

/** Cursor 로 내보낼 리뷰어 에이전트 (agents/ 최상위 파일명) */
const CURSOR_REVIEWER_FILES: ReadonlyArray<string> = [
  'code-reviewer.md',
  'security-reviewer.md',
];

/**
 * VIBE 에이전트를 Cursor 서브에이전트 형식으로 변환
 */
function convertAgentToCursor(content: string, filename: string): string {
  // Windows CRLF → LF 정규화
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const name = path.basename(filename, '.md');
  const model = CURSOR_MODEL_MAPPING[name] || 'auto';

  // 제목 추출
  const titleMatch = normalizedContent.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : name;

  // Role 섹션 추출 (## Role 다음 내용을 다음 ## 전까지)
  const roleMatch = normalizedContent.match(/## Role\s*\n([\s\S]*?)(?=\n## )/);
  const roleLines = roleMatch
    ? roleMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().replace(/^- /, '').trim())
        .slice(0, 3)
    : [];

  const roleDesc = roleLines.join(', ');
  const descriptions: Record<string, string> = {
    'code-reviewer': `Parameterized code reviewer (focus: correctness, architecture, performance, complexity, data-integrity, test-coverage, idioms, git-history). ${roleDesc}. Use proactively after code edits with an explicit focus.`,
    'security-reviewer': `Threat-model-first security reviewer. ${roleDesc}. Use proactively after changes involving authentication, user input, or data handling.`,
  };
  const description =
    descriptions[name] || `${title}. ${roleDesc}. Use proactively after code edits.`;

  // 기존 frontmatter 제거 후 본문 유지 (survivor 에이전트는 goal+constraints 본문)
  const body = normalizedContent.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

  return `---
name: ${name}
model: ${model}
description: ${description}
---

## When Invoked

1. Run \`git diff\` to see recent changes
2. Focus on modified files relevant to this review
3. Begin review immediately without asking questions

${body}
`;
}

/**
 * Cursor 서브에이전트 설치
 */
export function installCursorAgents(agentsSource: string, cursorAgentsDir: string): void {
  if (!fs.existsSync(agentsSource)) {
    console.log(`   ⚠️ agents directory not found: ${agentsSource}`);
    return;
  }

  ensureDir(cursorAgentsDir);

  let installed = 0;
  for (const file of CURSOR_REVIEWER_FILES) {
    const sourcePath = path.join(agentsSource, file);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`   ⚠️ Cursor reviewer source missing: ${file}`);
      continue;
    }
    try {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const cursorContent = convertAgentToCursor(content, file);
      fs.writeFileSync(path.join(cursorAgentsDir, file), cursorContent, 'utf-8');
      installed++;
    } catch (err) {
      console.warn(`   ⚠️ Failed to convert ${file}: ${(err as Error).message}`);
    }
  }

  console.log(`   📦 Cursor agents: ${installed}/${CURSOR_REVIEWER_FILES.length} installed`);
}
