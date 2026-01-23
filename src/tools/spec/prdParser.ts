/**
 * PRD Parser - PRD 문서에서 요구사항 추출
 * v2.6.0: Markdown/YAML 형식 지원
 *
 * 지원 형식:
 * - Markdown 섹션 기반 (## Requirements, ## Acceptance Criteria)
 * - YAML 프론트매터
 * - 번호/불릿 리스트
 */

import { generateRequirementId, registerExistingIds } from './requirementId.js';

// ============================================
// Types
// ============================================

/** 추출된 요구사항 */
export interface Requirement {
  id: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
  category?: string;
  source?: string; // 원본 위치 (줄 번호 등)
}

/** PRD 파싱 결과 */
export interface ParsedPRD {
  title: string;
  description?: string;
  requirements: Requirement[];
  metadata: PRDMetadata;
  raw: string;
}

/** PRD 메타데이터 */
export interface PRDMetadata {
  format: 'markdown' | 'yaml' | 'mixed';
  hasYamlFrontmatter: boolean;
  sectionCount: number;
  requirementCount: number;
  parseWarnings: string[];
}

// ============================================
// Main Parser
// ============================================

/**
 * PRD 문서 파싱 (메인 함수)
 */
export function parsePRD(content: string, featureName: string): ParsedPRD {
  const warnings: string[] = [];
  let format: PRDMetadata['format'] = 'markdown';

  // YAML 프론트매터 추출
  const { frontmatter, body } = extractYamlFrontmatter(content);
  const hasYamlFrontmatter = frontmatter !== null;
  if (hasYamlFrontmatter) {
    format = body.trim() ? 'mixed' : 'yaml';
  }

  // 제목 추출
  const title = extractTitle(body) || featureName;

  // 설명 추출
  const description = extractDescription(body);

  // 요구사항 추출
  const requirements = extractRequirements(body, featureName, warnings);

  // YAML에서 추가 요구사항 추출
  if (frontmatter) {
    const yamlReqs = extractRequirementsFromYaml(frontmatter, featureName, warnings);
    requirements.push(...yamlReqs);
  }

  // 중복 제거 및 ID 재할당
  const uniqueReqs = deduplicateRequirements(requirements);

  return {
    title,
    description,
    requirements: uniqueReqs,
    metadata: {
      format,
      hasYamlFrontmatter,
      sectionCount: countSections(body),
      requirementCount: uniqueReqs.length,
      parseWarnings: warnings,
    },
    raw: content,
  };
}

/**
 * 파일에서 PRD 파싱 (파일 경로)
 */
export async function parsePRDFile(filePath: string, featureName: string): Promise<ParsedPRD> {
  const fs = await import('fs');
  const content = fs.readFileSync(filePath, 'utf-8');
  return parsePRD(content, featureName);
}

// ============================================
// Extraction Functions
// ============================================

/**
 * YAML 프론트매터 추출
 */
function extractYamlFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (match) {
    return { frontmatter: match[1], body: match[2] };
  }
  return { frontmatter: null, body: content };
}

/**
 * 제목 추출 (첫 번째 # 헤더)
 */
function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * 설명 추출 (제목 다음 첫 번째 문단)
 */
function extractDescription(content: string): string | undefined {
  const lines = content.split('\n');
  let foundTitle = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (line.match(/^#\s+/)) {
      foundTitle = true;
      continue;
    }
    if (foundTitle) {
      if (line.match(/^##\s+/) || line.trim() === '') {
        if (descLines.length > 0) break;
        continue;
      }
      descLines.push(line);
    }
  }

  return descLines.length > 0 ? descLines.join('\n').trim() : undefined;
}

/**
 * Markdown에서 요구사항 추출
 */
function extractRequirements(
  content: string,
  featureName: string,
  warnings: string[]
): Requirement[] {
  const requirements: Requirement[] = [];

  // Requirements 섹션 찾기
  const reqSection = extractSection(content, ['Requirements', 'Functional Requirements', '요구사항', '기능 요구사항']);
  if (reqSection) {
    const items = extractListItems(reqSection);
    for (const item of items) {
      requirements.push({
        id: generateRequirementId(featureName),
        description: item.text,
        acceptanceCriteria: [],
        priority: inferPriority(item.text),
        source: `Requirements section`,
      });
    }
  }

  // Acceptance Criteria 섹션에서 AC 추출
  const acSection = extractSection(content, ['Acceptance Criteria', 'AC', '인수 조건', '승인 기준']);
  if (acSection) {
    const acItems = extractListItems(acSection);

    // AC를 기존 요구사항에 매핑 또는 새 요구사항 생성
    for (const ac of acItems) {
      // 이미 있는 요구사항과 매칭 시도
      const matched = requirements.find(r =>
        r.description.toLowerCase().includes(ac.text.toLowerCase().slice(0, 30))
      );

      if (matched) {
        matched.acceptanceCriteria.push(ac.text);
      } else {
        // 새 요구사항으로 추가 (AC만 있는 경우)
        requirements.push({
          id: generateRequirementId(featureName),
          description: `Acceptance Criteria: ${ac.text}`,
          acceptanceCriteria: [ac.text],
          priority: 'medium',
          source: `Acceptance Criteria section`,
        });
      }
    }
  }

  // User Stories 섹션
  const userStorySection = extractSection(content, ['User Stories', 'User Story', '사용자 스토리']);
  if (userStorySection) {
    const stories = extractUserStories(userStorySection);
    for (const story of stories) {
      requirements.push({
        id: generateRequirementId(featureName),
        description: story,
        acceptanceCriteria: [],
        priority: 'medium',
        source: `User Stories section`,
      });
    }
  }

  if (requirements.length === 0) {
    warnings.push('No requirements found in standard sections. Trying fallback extraction.');
    // Fallback: 모든 리스트 아이템 추출
    const allItems = extractListItems(content);
    for (const item of allItems) {
      if (item.text.length > 20) { // 너무 짧은 것 제외
        requirements.push({
          id: generateRequirementId(featureName),
          description: item.text,
          acceptanceCriteria: [],
          priority: 'medium',
          source: `Fallback extraction`,
        });
      }
    }
  }

  return requirements;
}

/**
 * YAML에서 요구사항 추출
 */
function extractRequirementsFromYaml(
  yaml: string,
  featureName: string,
  warnings: string[]
): Requirement[] {
  const requirements: Requirement[] = [];

  // 간단한 YAML 파싱 (requirements: 배열)
  const reqMatch = yaml.match(/requirements:\s*\n((?:\s+-\s+.+\n?)+)/);
  if (reqMatch) {
    const items = reqMatch[1].match(/-\s+(.+)/g);
    if (items) {
      for (const item of items) {
        const text = item.replace(/^-\s+/, '').trim();
        requirements.push({
          id: generateRequirementId(featureName),
          description: text,
          acceptanceCriteria: [],
          priority: 'medium',
          source: 'YAML frontmatter',
        });
      }
    }
  }

  return requirements;
}

/**
 * 섹션 추출
 */
function extractSection(content: string, sectionNames: string[]): string | null {
  for (const name of sectionNames) {
    const pattern = new RegExp(`^##\\s*${name}[:\\s]*\\n([\\s\\S]*?)(?=^##\\s|$)`, 'mi');
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * 리스트 아이템 추출 (불릿/번호)
 */
function extractListItems(content: string): { text: string; indent: number }[] {
  const items: { text: string; indent: number }[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // 불릿 리스트: -, *, •
    const bulletMatch = line.match(/^(\s*)[-*•]\s+(.+)/);
    if (bulletMatch) {
      items.push({
        text: bulletMatch[2].trim(),
        indent: bulletMatch[1].length,
      });
      continue;
    }

    // 번호 리스트: 1., 1), (1)
    const numberMatch = line.match(/^(\s*)(?:\d+[.)]\s*|\(\d+\)\s*)(.+)/);
    if (numberMatch) {
      items.push({
        text: numberMatch[2].trim(),
        indent: numberMatch[1].length,
      });
    }
  }

  return items;
}

/**
 * User Story 추출 (As a... I want... So that...)
 */
function extractUserStories(content: string): string[] {
  const stories: string[] = [];
  const pattern = /(?:As\s+(?:a|an)\s+.+?(?:,|\s))?I\s+want\s+.+?(?:so\s+that|because|in\s+order\s+to)\s+.+?[.!]/gi;
  const matches = content.match(pattern);
  if (matches) {
    stories.push(...matches.map(m => m.trim()));
  }
  return stories;
}

/**
 * 섹션 수 카운트
 */
function countSections(content: string): number {
  const matches = content.match(/^##\s+/gm);
  return matches ? matches.length : 0;
}

/**
 * 우선순위 추론
 */
function inferPriority(text: string): 'high' | 'medium' | 'low' {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('must') || lowerText.includes('critical') || lowerText.includes('required')) {
    return 'high';
  }
  if (lowerText.includes('should') || lowerText.includes('important')) {
    return 'medium';
  }
  if (lowerText.includes('nice to have') || lowerText.includes('optional') || lowerText.includes('could')) {
    return 'low';
  }
  return 'medium';
}

/**
 * 중복 요구사항 제거
 */
function deduplicateRequirements(requirements: Requirement[]): Requirement[] {
  const seen = new Set<string>();
  return requirements.filter(req => {
    const key = req.description.toLowerCase().slice(0, 50);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
