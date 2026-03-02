/**
 * Gemini CLI 전역 GEMINI.md 생성
 *
 * CLAUDE.md에서 VIBE 섹션을 읽어 GEMINI.md 형식으로 변환
 */

import path from 'path';
import fs from 'fs';

const CORE_START_MARKER = '# VIBE';
const CORE_END_MARKER = '<!-- VIBE:END -->';

/**
 * CLAUDE.md에서 VIBE 섹션 추출 (CLI-neutral 공통 내용)
 */
function getVibeInstructionContent(packageRoot: string): string {
  const claudeMdPath = path.join(packageRoot, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) return '';

  const content = fs.readFileSync(claudeMdPath, 'utf-8').replace(/\r\n/g, '\n');
  const startIdx = content.indexOf(CORE_START_MARKER);
  const endIdx = content.indexOf(CORE_END_MARKER);

  if (startIdx === -1) return '';
  const endPos = endIdx !== -1 ? endIdx + CORE_END_MARKER.length : content.length;

  return content.substring(startIdx, endPos);
}

/**
 * VIBE 내용을 Gemini CLI 형식으로 변환
 * - "Claude Code Exclusive" 문구 제거
 * - hooks 이벤트 이름을 Gemini 형식으로 변환
 * - 경로 참조를 ~/.gemini/ 기준으로 변환
 */
function adaptForGemini(content: string): string {
  let adapted = content;

  // "Claude Code Exclusive" 문구 제거
  adapted = adapted.replace(/\(Claude Code Exclusive\)/g, '');
  adapted = adapted.replace(/Claude Code Exclusive/g, '');

  // Hooks 이벤트 이름 변환 (Claude → Gemini)
  adapted = adapted.replace(/PreToolUse/g, 'BeforeTool');
  adapted = adapted.replace(/PostToolUse/g, 'AfterTool');
  adapted = adapted.replace(/UserPromptSubmit/g, 'BeforeAgent');
  adapted = adapted.replace(/\bStop\b/g, 'SessionEnd');

  // ~/.claude/ → ~/.gemini/ 경로 변환
  adapted = adapted.replace(/~\/\.claude\//g, '~/.gemini/');
  adapted = adapted.replace(/\.claude\//g, '.gemini/');

  // "Claude Code" → "Gemini CLI" 변환 (일반적 참조)
  adapted = adapted.replace(/Claude Code/g, 'Gemini CLI');

  return adapted.trim();
}

/**
 * 전역 ~/.gemini/GEMINI.md 생성
 */
export function generateGeminiMd(geminiDir: string, packageRoot: string): void {
  const vibeContent = getVibeInstructionContent(packageRoot);
  if (!vibeContent) return;

  const geminiContent = adaptForGemini(vibeContent);
  const geminiMdPath = path.join(geminiDir, 'GEMINI.md');

  fs.writeFileSync(geminiMdPath, geminiContent + '\n', 'utf-8');
}
