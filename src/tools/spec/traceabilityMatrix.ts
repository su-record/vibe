/**
 * Traceability Matrix - 요구사항 추적 매트릭스 자동 생성
 * v2.6.0: RTM (Requirements Traceability Matrix) 자동화
 *
 * 매핑: REQ → SPEC → Feature → Test
 */

import { Requirement, ParsedPRD } from './prdParser.js';
import { validateRequirementId, extractFeatureFromId } from './requirementId.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

/** 추적 항목 */
export interface TraceItem {
  requirementId: string;
  requirementDesc: string;
  specSection?: string;
  specFile?: string;
  featureScenario?: string;
  featureFile?: string;
  testFile?: string;
  testName?: string;
  coverage: 'full' | 'partial' | 'none';
}

/** 추적 매트릭스 */
export interface TraceabilityMatrix {
  featureName: string;
  items: TraceItem[];
  summary: TraceSummary;
  generatedAt: string;
}

/** 추적 요약 */
export interface TraceSummary {
  totalRequirements: number;
  specCovered: number;
  featureCovered: number;
  testCovered: number;
  coveragePercent: number;
  uncoveredRequirements: string[];
  partialRequirements: string[];
}

/** 매트릭스 생성 옵션 */
export interface TraceMatrixOptions {
  specPath?: string;
  featurePath?: string;
  testPath?: string;
  projectPath?: string;
}

// ============================================
// Main Functions
// ============================================

/**
 * 추적 매트릭스 생성 (메인 함수)
 */
export function generateTraceabilityMatrix(
  featureName: string,
  options: TraceMatrixOptions = {}
): TraceabilityMatrix {
  const {
    projectPath = process.cwd(),
    specPath = `.claude/vibe/specs/${featureName}.md`,
    featurePath = `.claude/vibe/features/${featureName}.feature`,
    testPath,
  } = options;

  const items: TraceItem[] = [];
  const warnings: string[] = [];

  // SPEC 파일 파싱
  const specContent = readFileSafe(path.join(projectPath, specPath));
  const specRequirements = specContent ? extractRequirementsFromSpec(specContent) : [];

  // Feature 파일 파싱
  const featureContent = readFileSafe(path.join(projectPath, featurePath));
  const featureScenarios = featureContent ? extractScenariosFromFeature(featureContent) : [];

  // 테스트 파일 파싱 (있으면)
  const testFiles = testPath
    ? findTestFiles(path.join(projectPath, testPath))
    : findTestFilesForFeature(projectPath, featureName);
  const testMappings = extractTestMappings(testFiles);

  // 매트릭스 구축
  for (const req of specRequirements) {
    const item: TraceItem = {
      requirementId: req.id,
      requirementDesc: req.description,
      specSection: req.section,
      specFile: specPath,
      coverage: 'none',
    };

    // Feature 시나리오 매핑
    const matchingScenario = findMatchingScenario(req.id, req.description, featureScenarios);
    if (matchingScenario) {
      item.featureScenario = matchingScenario.name;
      item.featureFile = featurePath;
      item.coverage = 'partial';
    }

    // 테스트 매핑
    const matchingTest = findMatchingTest(req.id, req.description, testMappings);
    if (matchingTest) {
      item.testFile = matchingTest.file;
      item.testName = matchingTest.name;
      item.coverage = item.featureScenario ? 'full' : 'partial';
    }

    items.push(item);
  }

  // 요약 계산
  const summary = calculateSummary(items);

  return {
    featureName,
    items,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 매트릭스를 Markdown 테이블로 출력
 */
export function formatMatrixAsMarkdown(matrix: TraceabilityMatrix): string {
  let output = `# Requirements Traceability Matrix: ${matrix.featureName}\n\n`;
  output += `Generated: ${matrix.generatedAt}\n\n`;

  // 요약
  output += `## Summary\n\n`;
  output += `| Metric | Value |\n`;
  output += `|--------|-------|\n`;
  output += `| Total Requirements | ${matrix.summary.totalRequirements} |\n`;
  output += `| SPEC Coverage | ${matrix.summary.specCovered}/${matrix.summary.totalRequirements} |\n`;
  output += `| Feature Coverage | ${matrix.summary.featureCovered}/${matrix.summary.totalRequirements} |\n`;
  output += `| Test Coverage | ${matrix.summary.testCovered}/${matrix.summary.totalRequirements} |\n`;
  output += `| **Overall Coverage** | **${matrix.summary.coveragePercent}%** |\n\n`;

  // 매트릭스 테이블
  output += `## Traceability Matrix\n\n`;
  output += `| Requirement | SPEC | Feature | Test | Coverage |\n`;
  output += `|-------------|------|---------|------|----------|\n`;

  for (const item of matrix.items) {
    const reqCell = `${item.requirementId}`;
    const specCell = item.specSection ? `✅ ${item.specSection}` : '❌';
    const featureCell = item.featureScenario ? `✅ ${truncate(item.featureScenario, 30)}` : '❌';
    const testCell = item.testName ? `✅ ${truncate(item.testName, 30)}` : '❌';
    const coverageIcon = getCoverageIcon(item.coverage);

    output += `| ${reqCell} | ${specCell} | ${featureCell} | ${testCell} | ${coverageIcon} |\n`;
  }

  // 미커버리지 항목
  if (matrix.summary.uncoveredRequirements.length > 0) {
    output += `\n## Uncovered Requirements\n\n`;
    output += `The following requirements lack full coverage:\n\n`;
    for (const reqId of matrix.summary.uncoveredRequirements) {
      const item = matrix.items.find(i => i.requirementId === reqId);
      output += `- **${reqId}**: ${item?.requirementDesc || 'Unknown'}\n`;
    }
  }

  // 권장사항
  output += `\n## Recommendations\n\n`;
  if (matrix.summary.coveragePercent >= 100) {
    output += `✅ All requirements are fully covered!\n`;
  } else {
    output += `⚠️ Coverage is at ${matrix.summary.coveragePercent}%. Consider:\n`;
    if (matrix.summary.featureCovered < matrix.summary.totalRequirements) {
      output += `- Add Feature scenarios for uncovered requirements\n`;
    }
    if (matrix.summary.testCovered < matrix.summary.totalRequirements) {
      output += `- Add test cases for uncovered requirements\n`;
    }
  }

  return output;
}

/**
 * 매트릭스를 HTML로 출력
 */
export function formatMatrixAsHtml(matrix: TraceabilityMatrix): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>RTM: ${matrix.featureName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .full { background: #d4edda; }
    .partial { background: #fff3cd; }
    .none { background: #f8d7da; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .summary-card { padding: 1rem; border-radius: 8px; background: #f5f5f5; }
    .coverage-bar { height: 20px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .coverage-fill { height: 100%; background: #4caf50; }
  </style>
</head>
<body>
  <h1>RTM: ${matrix.featureName}</h1>
  <p>Generated: ${matrix.generatedAt}</p>

  <div class="summary">
    <div class="summary-card">
      <strong>Requirements</strong><br>${matrix.summary.totalRequirements}
    </div>
    <div class="summary-card">
      <strong>Feature Coverage</strong><br>${matrix.summary.featureCovered}/${matrix.summary.totalRequirements}
    </div>
    <div class="summary-card">
      <strong>Test Coverage</strong><br>${matrix.summary.testCovered}/${matrix.summary.totalRequirements}
    </div>
    <div class="summary-card">
      <strong>Overall</strong><br>
      <div class="coverage-bar">
        <div class="coverage-fill" style="width: ${matrix.summary.coveragePercent}%"></div>
      </div>
      ${matrix.summary.coveragePercent}%
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Requirement</th>
        <th>Description</th>
        <th>SPEC</th>
        <th>Feature</th>
        <th>Test</th>
        <th>Coverage</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const item of matrix.items) {
    html += `      <tr class="${item.coverage}">
        <td>${item.requirementId}</td>
        <td>${escapeHtml(truncate(item.requirementDesc, 50))}</td>
        <td>${item.specSection ? '✅' : '❌'}</td>
        <td>${item.featureScenario ? '✅' : '❌'}</td>
        <td>${item.testName ? '✅' : '❌'}</td>
        <td>${getCoverageIcon(item.coverage)}</td>
      </tr>
`;
  }

  html += `    </tbody>
  </table>
</body>
</html>`;

  return html;
}

// ============================================
// Parsing Functions
// ============================================

/**
 * SPEC에서 요구사항 추출
 */
function extractRequirementsFromSpec(content: string): { id: string; description: string; section: string }[] {
  const requirements: { id: string; description: string; section: string }[] = [];

  // REQ-xxx-xxx 패턴 찾기
  const reqPattern = /\b(REQ-[a-z0-9-]+-\d{3})[:\s]*([^\n]+)/gi;
  let match;

  while ((match = reqPattern.exec(content)) !== null) {
    requirements.push({
      id: match[1],
      description: match[2].trim(),
      section: findSection(content, match.index),
    });
  }

  // AC 섹션에서도 추출
  const acPattern = /###\s*([^\n]+)\n(?:[\s\S]*?)- \[ \] (.+)/g;
  while ((match = acPattern.exec(content)) !== null) {
    const id = match[1].match(/REQ-[a-z0-9-]+-\d{3}/)?.[0];
    if (id && !requirements.find(r => r.id === id)) {
      requirements.push({
        id,
        description: match[2].trim(),
        section: 'Acceptance Criteria',
      });
    }
  }

  return requirements;
}

/**
 * Feature 파일에서 시나리오 추출
 */
function extractScenariosFromFeature(content: string): { name: string; verification?: string }[] {
  const scenarios: { name: string; verification?: string }[] = [];
  const scenarioPattern = /###\s*Scenario\s*\d*[:\s]*([^\n]+)[\s\S]*?(?:\*\*Verification\*\*[:\s]*([^\n]+))?/gi;
  let match;

  while ((match = scenarioPattern.exec(content)) !== null) {
    scenarios.push({
      name: match[1].trim(),
      verification: match[2]?.trim(),
    });
  }

  return scenarios;
}

/**
 * 테스트 파일에서 매핑 추출
 */
function extractTestMappings(testFiles: string[]): { file: string; name: string; reqId?: string }[] {
  const mappings: { file: string; name: string; reqId?: string }[] = [];

  for (const file of testFiles) {
    const content = readFileSafe(file);
    if (!content) continue;

    // describe/it/test 패턴
    const testPattern = /(?:describe|it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = testPattern.exec(content)) !== null) {
      const name = match[1];
      const reqId = name.match(/REQ-[a-z0-9-]+-\d{3}/)?.[0];
      mappings.push({
        file: path.basename(file),
        name,
        reqId,
      });
    }
  }

  return mappings;
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

function findSection(content: string, index: number): string {
  const before = content.slice(0, index);
  const sectionMatch = before.match(/###\s*([^\n]+)/g);
  return sectionMatch ? sectionMatch[sectionMatch.length - 1].replace(/^###\s*/, '') : 'Unknown';
}

function findMatchingScenario(
  reqId: string,
  reqDesc: string,
  scenarios: { name: string; verification?: string }[]
): { name: string } | null {
  // ID로 매칭
  for (const scenario of scenarios) {
    if (scenario.verification?.includes(reqId)) {
      return scenario;
    }
  }

  // 설명 유사도로 매칭 (간단한 매칭)
  const keywords = reqDesc.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  for (const scenario of scenarios) {
    const scenarioLower = scenario.name.toLowerCase();
    const matchCount = keywords.filter(k => scenarioLower.includes(k)).length;
    if (matchCount >= 2) {
      return scenario;
    }
  }

  return null;
}

function findMatchingTest(
  reqId: string,
  reqDesc: string,
  tests: { file: string; name: string; reqId?: string }[]
): { file: string; name: string } | null {
  // ID로 매칭
  for (const test of tests) {
    if (test.reqId === reqId) {
      return test;
    }
  }

  // 설명 유사도로 매칭
  const keywords = reqDesc.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  for (const test of tests) {
    const testLower = test.name.toLowerCase();
    const matchCount = keywords.filter(k => testLower.includes(k)).length;
    if (matchCount >= 2) {
      return test;
    }
  }

  return null;
}

function findTestFiles(basePath: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTestFiles(fullPath));
      } else if (entry.name.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

function findTestFilesForFeature(projectPath: string, featureName: string): string[] {
  const possiblePaths = [
    path.join(projectPath, 'src', '__tests__'),
    path.join(projectPath, 'src', 'tests'),
    path.join(projectPath, 'tests'),
    path.join(projectPath, '__tests__'),
    path.join(projectPath, 'test'),
  ];

  const files: string[] = [];
  for (const basePath of possiblePaths) {
    files.push(...findTestFiles(basePath));
  }

  // Feature 이름과 관련된 파일 필터링
  const normalized = featureName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return files.filter(f => {
    const basename = path.basename(f).toLowerCase().replace(/[^a-z0-9]/g, '');
    return basename.includes(normalized) || normalized.includes(basename.replace(/testspec/g, ''));
  });
}

function calculateSummary(items: TraceItem[]): TraceSummary {
  const totalRequirements = items.length;
  const specCovered = items.filter(i => i.specSection).length;
  const featureCovered = items.filter(i => i.featureScenario).length;
  const testCovered = items.filter(i => i.testName).length;
  const fullCovered = items.filter(i => i.coverage === 'full').length;

  const coveragePercent = totalRequirements > 0
    ? Math.round((fullCovered / totalRequirements) * 100)
    : 0;

  const uncoveredRequirements = items
    .filter(i => i.coverage === 'none')
    .map(i => i.requirementId);

  const partialRequirements = items
    .filter(i => i.coverage === 'partial')
    .map(i => i.requirementId);

  return {
    totalRequirements,
    specCovered,
    featureCovered,
    testCovered,
    coveragePercent,
    uncoveredRequirements,
    partialRequirements,
  };
}

function getCoverageIcon(coverage: TraceItem['coverage']): string {
  switch (coverage) {
    case 'full': return '✅ Full';
    case 'partial': return '⚠️ Partial';
    case 'none': return '❌ None';
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
