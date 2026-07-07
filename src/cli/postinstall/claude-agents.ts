/**
 * Claude Code 네이티브 서브에이전트 변환 및 설치
 *
 * VIBE 에이전트 마크다운 파일을 Claude Code 네이티브 서브에이전트 형식
 * (YAML frontmatter 포함)으로 변환하여 ~/.claude/agents/에 설치
 */

import path from 'path';
import fs from 'fs';
import { ensureDir, removeDirRecursive } from './fs-utils.js';
import {
  CLAUDE_MODEL_MAPPING,
  CLAUDE_AGENT_TOOLS,
  CLAUDE_AGENT_TOOL_CATEGORY,
  CLAUDE_AGENT_PERMISSION_MODE,
  CLAUDE_AGENT_DISALLOWED_TOOLS,
  CLAUDE_AGENT_MEMORY,
} from './constants.js';

/**
 * 에이전트별 description 생성
 */
function generateDescription(name: string, title: string, roleLines: string[]): string {
  const roleDesc = roleLines.join(', ');

  const descriptions: Record<string, string> = {
    'architect': `System architecture and design specialist. ${roleDesc}. Use proactively for architecture decisions, trade-off analysis, and security-critical designs.`,
    'implementer': `Core implementation specialist. ${roleDesc}. Use for feature implementation, refactoring, and bug fixes.`,
    'tester': `Test writing specialist with edge-case heuristics (input/state/environment/data boundaries). ${roleDesc}. Use proactively after implementing new features to generate comprehensive tests.`,
    'e2e-tester': `E2E testing specialist with Playwright. ${roleDesc}. Use for browser-based testing, visual regression, and accessibility checks.`,
    'build-error-resolver': `Minimal-diff build error fixer. ${roleDesc}. Use when TypeScript compilation or build fails.`,
    // 리뷰어 — /vibe.review 가 focus 파라미터로 호출 (개별 자동 발화 없음: 중복/상충 리뷰 방지)
    'code-reviewer': `Parameterized code reviewer — caller passes focus: correctness, architecture, performance, complexity, data-integrity, test-coverage, idioms, git-history. ${roleDesc}. Invoked by /vibe.review with a focus (not a standalone auto-trigger).`,
    'security-reviewer': `Threat-model-first security reviewer. ${roleDesc}. High-signal checks (injection, authz/IDOR, SSRF, secrets, timing-safe comparison) + dependency audit. Invoked by /vibe.review or on security-critical changes.`,
    // UI agents (conditional group)
    'design-reviewer': `UI design reviewer — WCAG AA, interaction states, MASTER.md token drift, AI-slop/dark-pattern detection. ${roleDesc}. Report-only.`,
    'design-system-gen': `Design system generator. ${roleDesc}. 산업 분석 → MASTER.md(CSS 변수/팔레트/타이포/스페이싱) + 레이아웃/차트 가이드 생성·저장.`,
    // Event agents (conditional group)
    'event-planner': `Community event planner — schedule/speaker/content. ${roleDesc}. D-Day 체크리스트, Notion DB, 연사 스펙, 홍보 콘텐츠 생성.`,
    'event-ops': `Community event operations — logistics/comms/images. ${roleDesc}. 명찰·정산·안내 발송(테스트모드 안전규칙 포함)·행사 이미지 생성.`,
  };

  return descriptions[name] || `${title}. ${roleDesc}. Use proactively when relevant.`;
}

/**
 * VIBE 에이전트를 Claude Code 네이티브 서브에이전트 형식으로 변환
 */
function convertAgentToClaude(content: string, filename: string): string {
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const name = path.basename(filename, '.md');
  const model = CLAUDE_MODEL_MAPPING[name] || 'sonnet';

  // 도구 해석
  const toolCategory = CLAUDE_AGENT_TOOL_CATEGORY[name] || 'read-only';
  const tools = CLAUDE_AGENT_TOOLS[toolCategory] || CLAUDE_AGENT_TOOLS['read-only'];

  // 권한 모드
  const permissionMode = CLAUDE_AGENT_PERMISSION_MODE[name] || 'default';

  // 차단 도구 (선택)
  const disallowedTools = CLAUDE_AGENT_DISALLOWED_TOOLS[name];

  // 메모리 (선택)
  const memory = CLAUDE_AGENT_MEMORY[name];

  // 제목 추출
  const titleMatch = normalizedContent.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : name;

  // Role 섹션 추출 (cursor-agents.ts와 동일 패턴)
  const roleMatch = normalizedContent.match(/## Role\s*\n([\s\S]*?)(?=\n## )/);
  const roleLines = roleMatch
    ? roleMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().replace(/^- /, '').trim())
        .slice(0, 3)
    : [];

  // Description 생성
  const description = generateDescription(name, title, roleLines);

  // YAML frontmatter 조립
  let frontmatter = '---\n';
  frontmatter += `name: ${name}\n`;
  frontmatter += `description: ${description}\n`;
  frontmatter += `model: ${model}\n`;
  frontmatter += `tools: ${tools.join(', ')}\n`;
  frontmatter += `permissionMode: ${permissionMode}\n`;

  if (disallowedTools && disallowedTools.length > 0) {
    frontmatter += `disallowedTools: ${disallowedTools.join(', ')}\n`;
  }

  if (memory) {
    frontmatter += `memory: ${memory}\n`;
  }

  frontmatter += '---\n';

  // 기존 frontmatter 제거 후 원본 본문 유지
  const bodyContent = normalizedContent.replace(/^---\n[\s\S]*?\n---\n/, '');

  return `${frontmatter}\n${bodyContent}`;
}

export interface InstallClaudeAgentsOptions {
  /** 최상위 디렉토리명 기준 제외 목록 (예: 조건부 그룹 'ui'/'figma'/'event') */
  skipDirs?: ReadonlyArray<string>;
  /** 지정 시 이 최상위 디렉토리들만 설치 (프로젝트 로컬 조건부 설치용) */
  onlyDirs?: ReadonlyArray<string>;
}

/**
 * Claude Code 네이티브 서브에이전트 설치
 *
 * agents/ 디렉토리를 재귀 순회하여 모든 .md 파일을 변환 후 설치.
 * `agents/teams/` 는 단일 sub-agent가 아닌 다중 agent 메타 문서이므로
 * 별도 위치(vibe core)에 보관하며 Claude Code sub-agent로는 등록하지 않는다.
 *
 * options.skipDirs / options.onlyDirs 로 최상위 그룹 디렉토리를 선별한다 —
 * 전역 설치는 조건부 그룹(ui/figma/event)을 제외하고, vibe init/update가
 * 스택·capability 매칭 시 해당 그룹만 프로젝트 로컬에 설치한다.
 */
export function installClaudeAgents(
  agentsSource: string,
  claudeAgentsDir: string,
  options: InstallClaudeAgentsOptions = {},
): void {
  if (!fs.existsSync(agentsSource)) {
    console.log(`   ⚠️ agents directory not found: ${agentsSource}`);
    return;
  }

  // 클린 설치 (이전 버전 잔여 파일 방지)
  // onlyDirs(프로젝트 로컬 조건부 설치)일 때는 사용자 자작 에이전트를 보존해야
  // 하므로 전체 wipe 대신 대상 그룹 디렉토리만 재설치한다.
  if (options.onlyDirs) {
    for (const dir of options.onlyDirs) {
      const groupDir = path.join(claudeAgentsDir, dir);
      if (fs.existsSync(groupDir)) removeDirRecursive(groupDir);
    }
  } else if (fs.existsSync(claudeAgentsDir)) {
    removeDirRecursive(claudeAgentsDir);
  }
  ensureDir(claudeAgentsDir);

  let installed = 0;
  let total = 0;
  let teamsSkipped = 0;

  function processDirectory(srcDir: string, destDir: string, relPath: string): void {
    ensureDir(destDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;

      // teams/ 는 메타 문서 — sub-agent 등록에서 제외
      if (entry.isDirectory() && entry.name === 'teams' && relPath === '') {
        const teamCount = fs.readdirSync(srcPath, { recursive: true } as { recursive: true })
          .filter((f): f is string => typeof f === 'string' && f.endsWith('.md')).length;
        teamsSkipped = teamCount;
        continue;
      }

      // 최상위 그룹 디렉토리 필터 (skipDirs / onlyDirs)
      if (relPath === '') {
        if (entry.isDirectory() && options.skipDirs?.includes(entry.name)) continue;
        if (options.onlyDirs && (!entry.isDirectory() || !options.onlyDirs.includes(entry.name))) continue;
      }

      if (entry.isDirectory()) {
        processDirectory(srcPath, destPath, childRel);
      } else if (entry.name.endsWith('.md')) {
        total++;
        try {
          const content = fs.readFileSync(srcPath, 'utf-8');
          const claudeContent = convertAgentToClaude(content, entry.name);
          fs.writeFileSync(destPath, claudeContent, 'utf-8');
          installed++;
        } catch (err) {
          console.warn(`   ⚠️ Failed to convert ${entry.name}: ${(err as Error).message}`);
        }
      }
    }
  }

  processDirectory(agentsSource, claudeAgentsDir, '');
  const skipNote = teamsSkipped > 0 ? ` (+${teamsSkipped} teams skipped — meta docs)` : '';
  console.log(`   📦 Claude agents: ${installed}/${total} installed${skipNote}`);
}
