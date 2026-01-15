/**
 * Agent Discovery - .claude/agents/ 폴더에서 에이전트 동적 탐색
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { DiscoveredAgent, AgentDiscoveryArgs } from './types.js';
import { ToolResult } from '../types/tool.js';
import { errorLog } from '../lib/utils.js';

// 에이전트 디렉토리 우선순위: .claude/agents > agents
const AGENTS_DIRS = ['.claude/agents', 'agents'];

/**
 * 에이전트 마크다운 파일에서 메타데이터 추출
 */
function parseAgentMarkdown(content: string, filePath: string): Partial<DiscoveredAgent> {
  const lines = content.split('\n');
  let name = path.basename(filePath, '.md');
  let description = '';

  // 첫 번째 # 헤더에서 이름 추출
  for (const line of lines) {
    if (line.startsWith('# ')) {
      name = line.slice(2).trim();
      break;
    }
  }

  // 첫 번째 일반 텍스트 단락에서 설명 추출
  let inDescription = false;
  for (const line of lines) {
    if (line.startsWith('# ') || line.startsWith('## ')) {
      if (inDescription) break;
      inDescription = true;
      continue;
    }
    if (inDescription && line.trim() && !line.startsWith('#') && !line.startsWith('```')) {
      description = line.trim();
      break;
    }
  }

  return { name, description };
}

/**
 * 카테고리 추출 (폴더명 기반)
 */
function extractCategory(filePath: string, basePath: string): string {
  const relativePath = path.relative(basePath, filePath);
  const parts = relativePath.split(path.sep);

  // agents/review/xxx.md -> review
  // agents/research/xxx.md -> research
  if (parts.length > 1) {
    return parts[0];
  }
  return 'general';
}

/**
 * 에이전트 동적 탐색
 */
export async function discoverAgents(args: AgentDiscoveryArgs): Promise<ToolResult> {
  const { projectPath = process.cwd(), category, pattern } = args;

  try {
    // 에이전트 디렉토리 찾기 (우선순위대로)
    let agentsBasePath: string | null = null;
    for (const dir of AGENTS_DIRS) {
      const candidatePath = path.join(projectPath, dir);
      try {
        await fs.access(candidatePath);
        agentsBasePath = candidatePath;
        break;
      } catch { /* ignore: optional operation */
        // 다음 경로 시도
      }
    }

    if (!agentsBasePath) {
      return {
        content: [{
          type: 'text',
          text: `No agents directory found. Searched: ${AGENTS_DIRS.join(', ')}. Create agents in .claude/agents/ or agents/ folder.`
        }]
      };
    }

    // 패턴 구성
    let searchPattern = '**/*.md';
    if (category) {
      searchPattern = `${category}/**/*.md`;
    }
    if (pattern) {
      searchPattern = pattern;
    }

    // 에이전트 파일 검색
    const agentFiles = await glob(searchPattern, {
      cwd: agentsBasePath,
      absolute: true
    });

    if (agentFiles.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No agents found matching pattern: ${searchPattern}`
        }]
      };
    }

    // 에이전트 정보 수집
    const agents: DiscoveredAgent[] = [];

    for (const filePath of agentFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const metadata = parseAgentMarkdown(content, filePath);
        const agentCategory = extractCategory(filePath, agentsBasePath);

        agents.push({
          name: metadata.name || path.basename(filePath, '.md'),
          path: path.relative(projectPath, filePath),
          category: agentCategory,
          description: metadata.description || '',
          content
        });
      } catch (error) {
        // 개별 파일 에러는 무시하고 계속 진행
        errorLog(`Failed to read agent file: ${filePath}`, error);
      }
    }

    // 카테고리별 그룹핑
    const byCategory = agents.reduce((acc, agent) => {
      if (!acc[agent.category]) {
        acc[agent.category] = [];
      }
      acc[agent.category].push(agent);
      return acc;
    }, {} as Record<string, DiscoveredAgent[]>);

    // 결과 포맷팅
    let summary = `## Discovered Agents (${agents.length} total)\n\n`;

    for (const [cat, catAgents] of Object.entries(byCategory)) {
      summary += `### ${cat} (${catAgents.length})\n`;
      for (const agent of catAgents) {
        summary += `- **${agent.name}**: ${agent.description || 'No description'}\n`;
        summary += `  Path: ${agent.path}\n`;
      }
      summary += '\n';
    }

    return {
      content: [{ type: 'text', text: summary }],
      agents // 추가 데이터로 에이전트 목록 포함
    } as ToolResult & { agents: DiscoveredAgent[] };

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Failed to discover agents: ${error instanceof Error ? error.message : String(error)}`
      }]
    };
  }
}

/**
 * 특정 에이전트 로드
 */
export async function loadAgent(agentName: string, projectPath: string = process.cwd()): Promise<DiscoveredAgent | null> {
  const result = await discoverAgents({ projectPath });

  if ('agents' in result) {
    const agents = (result as ToolResult & { agents: DiscoveredAgent[] }).agents;
    return agents.find(a =>
      a.name.toLowerCase() === agentName.toLowerCase() ||
      a.path.includes(agentName)
    ) || null;
  }

  return null;
}

/**
 * 카테고리별 에이전트 목록
 */
export async function listAgentsByCategory(category: string, projectPath: string = process.cwd()): Promise<DiscoveredAgent[]> {
  const result = await discoverAgents({ projectPath, category });

  if ('agents' in result) {
    return (result as ToolResult & { agents: DiscoveredAgent[] }).agents;
  }

  return [];
}
