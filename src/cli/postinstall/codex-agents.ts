/**
 * Codex CLI 에이전트 설치
 *
 * Codex agents는 YAML frontmatter 없는 순수 마크다운 형식이므로
 * 변환 없이 직접 복사합니다.
 */

import path from 'path';
import fs from 'fs';
import { ensureDir, removeDirRecursive } from './fs-utils.js';

/**
 * Codex CLI 에이전트 설치
 * agents/ → ~/.codex/agents/ 재귀 복사 (.md 파일만)
 */
export function installCodexAgents(agentsSource: string, codexAgentsDir: string): void {
  if (!fs.existsSync(agentsSource)) {
    return;
  }

  // 클린 설치
  if (fs.existsSync(codexAgentsDir)) {
    removeDirRecursive(codexAgentsDir);
  }
  ensureDir(codexAgentsDir);

  let installed = 0;

  function processDirectory(srcDir: string, destDir: string): void {
    ensureDir(destDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        processDirectory(srcPath, destPath);
      } else if (entry.name.endsWith('.md')) {
        try {
          // Codex는 순수 마크다운 — 기존 YAML frontmatter만 제거하고 복사
          let content = fs.readFileSync(srcPath, 'utf-8');
          content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          content = content.replace(/^---\n[\s\S]*?\n---\n/, '');
          fs.writeFileSync(destPath, content.trimStart(), 'utf-8');
          installed++;
        } catch {
          // skip failed files
        }
      }
    }
  }

  processDirectory(agentsSource, codexAgentsDir);
  console.log(`   📦 Codex agents: ${installed} installed`);
}
