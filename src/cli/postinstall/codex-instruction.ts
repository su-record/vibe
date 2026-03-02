/**
 * Codex CLI 전역 AGENTS.md 생성
 *
 * CLAUDE.md에서 VIBE 섹션을 읽어 Codex AGENTS.md 형식으로 변환
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
 * VIBE 내용을 Codex 형식으로 변환
 * - "Claude Code Exclusive" 문구 제거
 * - hooks 관련 섹션 제거 (Codex 미지원)
 * - 경로 참조를 ~/.codex/ 기준으로 변환
 */
function adaptForCodex(content: string): string {
  let adapted = content;

  // "Claude Code Exclusive" 문구 제거
  adapted = adapted.replace(/\(Claude Code Exclusive\)/g, '');
  adapted = adapted.replace(/Claude Code Exclusive/g, '');

  // Hooks System 섹션 제거 (Codex 미지원)
  adapted = adapted.replace(/## Hooks System\n[\s\S]*?(?=\n## )/g, '');

  // ~/.claude/ → ~/.codex/ 경로 변환
  adapted = adapted.replace(/~\/\.claude\//g, '~/.codex/');
  adapted = adapted.replace(/\.claude\//g, '.codex/');

  // "Claude Code" → "Codex CLI" 변환 (일반적 참조)
  adapted = adapted.replace(/Claude Code/g, 'Codex CLI');

  return adapted.trim();
}

/**
 * 전역 ~/.codex/AGENTS.md 생성
 */
export function generateCodexAgentsMd(codexDir: string, packageRoot: string): void {
  const vibeContent = getVibeInstructionContent(packageRoot);
  if (!vibeContent) return;

  const codexContent = adaptForCodex(vibeContent);
  const agentsMdPath = path.join(codexDir, 'AGENTS.md');

  fs.writeFileSync(agentsMdPath, codexContent + '\n', 'utf-8');
}
