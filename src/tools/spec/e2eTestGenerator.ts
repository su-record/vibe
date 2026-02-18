/**
 * E2E Test Generator - SPEC acceptance criteria + Feature scenarios → Playwright test skeletons
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

/** Phase별 acceptance criteria */
export interface AcceptanceCriterion {
  phase: string;
  phaseName: string;
  criteria: string[];
}

/** Gherkin 시나리오 (Given/When/Then 포함) */
export interface GherkinScenario {
  name: string;
  phase: string;
  given: string[];
  when: string[];
  then: string[];
  and: string[];
  verification?: string;
}

/** 생성된 E2E 테스트 */
export interface GeneratedE2ETest {
  fileName: string;
  content: string;
  scenarioCount: number;
  phase: string;
}

/** E2E 생성기 옵션 */
export interface E2EGeneratorOptions {
  specPath?: string;
  featurePath?: string;
  outputDir?: string;
  projectPath?: string;
}

/** 생성 결과 */
export interface E2EGenerationResult {
  featureName: string;
  tests: GeneratedE2ETest[];
  totalScenarios: number;
  outputDir: string;
}

// ============================================
// Parsing Functions
// ============================================

/**
 * SPEC의 <acceptance> 블록에서 Phase별 criteria 추출
 */
export function parseAcceptanceCriteria(specContent: string): AcceptanceCriterion[] {
  const results: AcceptanceCriterion[] = [];

  // <acceptance> 블록 추출
  const acceptanceMatch = specContent.match(/<acceptance>([\s\S]*?)<\/acceptance>/);
  if (!acceptanceMatch) return results;

  const block = acceptanceMatch[1];

  // Phase별로 분할
  const phasePattern = /###\s*Phase\s*(\d+)[:\s]*([^\n]*)\n([\s\S]*?)(?=###\s*Phase|\s*$)/gi;
  let match;

  while ((match = phasePattern.exec(block)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].trim();
    const criteriaBlock = match[3];

    // - [ ] 패턴으로 criteria 추출
    const criteria: string[] = [];
    const criteriaPattern = /- \[ \] (.+)/g;
    let criterionMatch;
    while ((criterionMatch = criteriaPattern.exec(criteriaBlock)) !== null) {
      criteria.push(criterionMatch[1].trim());
    }

    if (criteria.length > 0) {
      results.push({
        phase: phaseNum,
        phaseName,
        criteria,
      });
    }
  }

  return results;
}

/**
 * Feature 파일에서 Gherkin 시나리오 추출 (Given/When/Then 포함)
 */
export function parseGherkinScenarios(featureContent: string): GherkinScenario[] {
  const results: GherkinScenario[] = [];

  // Phase 추출
  const phasePattern = /##\s*Phase\s*(\d+)[:\s]*([^\n]*)\n([\s\S]*?)(?=##\s*Phase|\s*$)/gi;
  let phaseMatch;

  while ((phaseMatch = phasePattern.exec(featureContent)) !== null) {
    const phaseNum = phaseMatch[1];
    const phaseBlock = phaseMatch[3];

    // 시나리오 추출
    const scenarioPattern = /###\s*Scenario\s*\d*[:\s]*([^\n]*)\n```gherkin\n([\s\S]*?)```(?:\n\*\*Verification\*\*[:\s]*([^\n]*))?/gi;
    let scenarioMatch;

    while ((scenarioMatch = scenarioPattern.exec(phaseBlock)) !== null) {
      const name = scenarioMatch[1].trim();
      const gherkinBlock = scenarioMatch[2];
      const verification = scenarioMatch[3]?.trim();

      const given: string[] = [];
      const when: string[] = [];
      const then: string[] = [];
      const and: string[] = [];

      // Gherkin 라인 파싱
      const lines = gherkinBlock.split('\n').map(l => l.trim()).filter(Boolean);
      let currentSection: 'given' | 'when' | 'then' | null = null;

      for (const line of lines) {
        if (line.startsWith('Scenario:')) continue;

        if (line.startsWith('Given ')) {
          currentSection = 'given';
          given.push(line.replace(/^Given /, ''));
        } else if (line.startsWith('When ')) {
          currentSection = 'when';
          when.push(line.replace(/^When /, ''));
        } else if (line.startsWith('Then ')) {
          currentSection = 'then';
          then.push(line.replace(/^Then /, ''));
        } else if (line.startsWith('And ')) {
          const text = line.replace(/^And /, '');
          and.push(text);
          // And는 직전 섹션에 추가
          if (currentSection === 'given') given.push(text);
          else if (currentSection === 'when') when.push(text);
          else if (currentSection === 'then') then.push(text);
        }
      }

      results.push({
        name,
        phase: phaseNum,
        given,
        when,
        then,
        and,
        verification,
      });
    }
  }

  return results;
}

// ============================================
// Generation Functions
// ============================================

/**
 * Playwright test skeleton 생성
 */
export function generatePlaywrightSkeleton(
  criteria: AcceptanceCriterion[],
  scenarios: GherkinScenario[],
  featureName: string
): GeneratedE2ETest[] {
  const tests: GeneratedE2ETest[] = [];

  for (const phase of criteria) {
    const phaseScenarios = scenarios.filter(s => s.phase === phase.phase);
    const slugName = slugify(phase.phaseName || `phase-${phase.phase}`);
    const fileName = `phase-${phase.phase}-${slugName}.spec.ts`;

    let content = `import { test, expect } from '@playwright/test';\n\n`;
    content += `test.describe('Phase ${phase.phase}: ${phase.phaseName}', () => {\n`;

    let scenarioCount = 0;

    // Gherkin 시나리오 → test blocks
    for (const scenario of phaseScenarios) {
      content += `\n  test('${escapeQuotes(scenario.name)}', async ({ page }) => {\n`;

      if (scenario.given.length > 0) {
        content += `    // Given\n`;
        for (const g of scenario.given) {
          content += `    // - ${g}\n`;
        }
        content += `    // TODO: Setup test preconditions\n\n`;
      }

      if (scenario.when.length > 0) {
        content += `    // When\n`;
        for (const w of scenario.when) {
          content += `    // - ${w}\n`;
        }
        content += `    // TODO: Execute action\n\n`;
      }

      if (scenario.then.length > 0) {
        content += `    // Then\n`;
        for (const t of scenario.then) {
          content += `    // - ${t}\n`;
        }
        content += `    // TODO: Assert expected outcome\n`;
      }

      if (scenario.verification) {
        content += `\n    // Verification: ${scenario.verification}\n`;
      }

      content += `  });\n`;
      scenarioCount++;
    }

    // 매칭되지 않은 AC → 추가 test blocks
    const coveredByScenario = new Set(
      phaseScenarios.flatMap(s => {
        // verification 필드에서 AC 번호 추출
        const match = s.verification?.match(/#(\d+)/);
        return match ? [parseInt(match[1]) - 1] : [];
      })
    );

    for (let i = 0; i < phase.criteria.length; i++) {
      if (!coveredByScenario.has(i) && phaseScenarios.length > 0) {
        // 시나리오가 이미 있고 이 AC가 커버되지 않은 경우에만 추가
        content += `\n  test('AC: ${escapeQuotes(phase.criteria[i])}', async ({ page }) => {\n`;
        content += `    // TODO: Implement test for acceptance criterion\n`;
        content += `    // AC: Phase ${phase.phase} - ${phase.criteria[i]}\n`;
        content += `  });\n`;
        scenarioCount++;
      } else if (phaseScenarios.length === 0) {
        // Feature 시나리오가 없으면 AC에서만 생성
        content += `\n  test('${escapeQuotes(phase.criteria[i])}', async ({ page }) => {\n`;
        content += `    // TODO: Implement test for acceptance criterion\n`;
        content += `    // AC: Phase ${phase.phase} - ${phase.criteria[i]}\n`;
        content += `  });\n`;
        scenarioCount++;
      }
    }

    content += `});\n`;

    tests.push({
      fileName,
      content,
      scenarioCount,
      phase: `Phase ${phase.phase}: ${phase.phaseName}`,
    });
  }

  return tests;
}

/**
 * 메인 함수: SPEC + Feature → E2E test skeletons
 */
export function generateE2ETests(
  featureName: string,
  options: E2EGeneratorOptions = {}
): E2EGenerationResult {
  const {
    projectPath = process.cwd(),
    specPath = `.claude/vibe/specs/${featureName}.md`,
    featurePath = `.claude/vibe/features/${featureName}.feature`,
    outputDir = `tests/e2e/${featureName}`,
  } = options;

  // SPEC 파일 읽기
  const specFullPath = path.join(projectPath, specPath);
  const specContent = readFileSafe(specFullPath);

  // Feature 파일 읽기 (split 구조도 지원)
  let featureFullPath = path.join(projectPath, featurePath);
  let featureContent = readFileSafe(featureFullPath);

  // split 구조: {feature-name}/_index.feature
  if (!featureContent) {
    const splitPath = path.join(
      projectPath,
      `.claude/vibe/features/${featureName}/_index.feature`
    );
    featureContent = readFileSafe(splitPath);
    if (featureContent) featureFullPath = splitPath;
  }

  // 파싱
  const criteria = specContent ? parseAcceptanceCriteria(specContent) : [];
  const scenarios = featureContent ? parseGherkinScenarios(featureContent) : [];

  // 생성
  const tests = generatePlaywrightSkeleton(criteria, scenarios, featureName);

  const totalScenarios = tests.reduce((sum, t) => sum + t.scenarioCount, 0);

  return {
    featureName,
    tests,
    totalScenarios,
    outputDir,
  };
}

/**
 * 생성 결과 요약을 포맷팅
 */
export function formatGenerationSummary(result: E2EGenerationResult): string {
  if (result.tests.length === 0) {
    return 'No acceptance criteria or feature scenarios found to generate tests.';
  }

  let output = `Generated E2E test skeletons:\n`;
  for (const test of result.tests) {
    output += `  ${result.outputDir}/${test.fileName} (${test.scenarioCount} scenarios)\n`;
  }
  output += `  Total: ${result.totalScenarios} test skeletons across ${result.tests.length} files\n`;

  return output;
}

// ============================================
// Helper Functions
// ============================================

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function escapeQuotes(text: string): string {
  return text.replace(/'/g, "\\'");
}
