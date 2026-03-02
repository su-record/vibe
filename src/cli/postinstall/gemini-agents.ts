/**
 * Gemini CLI 에이전트 변환 및 설치
 *
 * VIBE 에이전트 마크다운 파일을 Gemini CLI 형식
 * (YAML frontmatter: name, description만) 으로 변환하여 ~/.gemini/agents/에 설치
 */

import path from 'path';
import fs from 'fs';
import { ensureDir, removeDirRecursive } from './fs-utils.js';

/**
 * VIBE 에이전트를 Gemini CLI 형식으로 변환
 * Gemini frontmatter: name, description만 (model/tools/permissionMode 없음)
 */
function convertAgentToGemini(content: string, filename: string): string {
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const name = path.basename(filename, '.md');

  // 제목 추출
  const titleMatch = normalizedContent.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : name;

  // Role 섹션 추출
  const roleMatch = normalizedContent.match(/## Role\s*\n([\s\S]*?)(?=\n## )/);
  const roleLines = roleMatch
    ? roleMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().replace(/^- /, '').trim())
        .slice(0, 3)
    : [];

  const description = roleLines.length > 0
    ? `${title}. ${roleLines.join(', ')}.`
    : title;

  // Gemini YAML frontmatter (name, description만)
  let frontmatter = '---\n';
  frontmatter += `name: ${name}\n`;
  frontmatter += `description: ${description}\n`;
  frontmatter += '---\n';

  // 기존 frontmatter 제거 후 원본 본문 유지
  const bodyContent = normalizedContent.replace(/^---\n[\s\S]*?\n---\n/, '');

  return `${frontmatter}\n${bodyContent}`;
}

/**
 * Gemini CLI 에이전트 설치
 * agents/ → ~/.gemini/agents/ 재귀 순회하여 변환 후 설치
 */
export function installGeminiAgents(agentsSource: string, geminiAgentsDir: string): void {
  if (!fs.existsSync(agentsSource)) {
    return;
  }

  // 클린 설치
  if (fs.existsSync(geminiAgentsDir)) {
    removeDirRecursive(geminiAgentsDir);
  }
  ensureDir(geminiAgentsDir);

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
          const content = fs.readFileSync(srcPath, 'utf-8');
          const geminiContent = convertAgentToGemini(content, entry.name);
          fs.writeFileSync(destPath, geminiContent, 'utf-8');
          installed++;
        } catch {
          // skip failed files
        }
      }
    }
  }

  processDirectory(agentsSource, geminiAgentsDir);
  console.log(`   📦 Gemini agents: ${installed} installed`);
}
