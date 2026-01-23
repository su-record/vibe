/**
 * SPEC Generator - PRD에서 PTCF 구조 SPEC 자동 생성
 * v2.6.0: PRD-to-SPEC 자동화
 *
 * PTCF: Persona, Task, Context, Format (Gemini 프롬프트 최적화)
 */

import { ParsedPRD, Requirement } from './prdParser.js';
import { generateRequirementId } from './requirementId.js';

// ============================================
// Types
// ============================================

/** SPEC 생성 옵션 */
export interface SpecGeneratorOptions {
  /** 기술 스택 */
  techStack?: string[];
  /** Phase 자동 분리 임계값 (요구사항 수) */
  phaseThreshold?: number;
  /** 관련 코드 경로 */
  relatedCodePaths?: string[];
  /** 디자인 레퍼런스 */
  designReference?: string;
  /** 제약 조건 추가 */
  additionalConstraints?: string[];
  /** 출력 형식 추가 */
  additionalOutputs?: string[];
}

/** 생성된 SPEC */
export interface GeneratedSpec {
  content: string;
  featureName: string;
  phaseCount: number;
  requirementCount: number;
  isSplit: boolean;
  splitFiles?: { path: string; content: string }[];
}

/** Phase 정보 */
interface PhaseInfo {
  name: string;
  requirements: Requirement[];
  tasks: string[];
}

// ============================================
// Main Generator
// ============================================

/**
 * PRD에서 SPEC 생성 (메인 함수)
 */
export function generateSpec(
  prd: ParsedPRD,
  featureName: string,
  options: SpecGeneratorOptions = {}
): GeneratedSpec {
  const {
    techStack = [],
    phaseThreshold = 5,
    relatedCodePaths = [],
    designReference,
    additionalConstraints = [],
    additionalOutputs = [],
  } = options;

  // Phase 분리 결정
  const shouldSplit = prd.requirements.length > phaseThreshold * 3;
  const phases = groupRequirementsIntoPhases(prd.requirements, phaseThreshold);

  if (shouldSplit) {
    return generateSplitSpec(prd, featureName, phases, options);
  }

  return generateSingleSpec(prd, featureName, phases, options);
}

/**
 * 단일 SPEC 파일 생성
 */
function generateSingleSpec(
  prd: ParsedPRD,
  featureName: string,
  phases: PhaseInfo[],
  options: SpecGeneratorOptions
): GeneratedSpec {
  const content = buildSpecContent(prd, featureName, phases, options);

  return {
    content,
    featureName,
    phaseCount: phases.length,
    requirementCount: prd.requirements.length,
    isSplit: false,
  };
}

/**
 * 분할 SPEC 파일 생성
 */
function generateSplitSpec(
  prd: ParsedPRD,
  featureName: string,
  phases: PhaseInfo[],
  options: SpecGeneratorOptions
): GeneratedSpec {
  const splitFiles: { path: string; content: string }[] = [];

  // 마스터 SPEC
  const masterContent = buildMasterSpecContent(prd, featureName, phases, options);
  splitFiles.push({
    path: `_index.md`,
    content: masterContent,
  });

  // Phase별 SPEC
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseContent = buildPhaseSpecContent(prd, featureName, phase, i + 1, phases.length, options);
    const phaseName = normalizeFileName(phase.name);
    splitFiles.push({
      path: `phase-${i + 1}-${phaseName}.md`,
      content: phaseContent,
    });
  }

  return {
    content: masterContent,
    featureName,
    phaseCount: phases.length,
    requirementCount: prd.requirements.length,
    isSplit: true,
    splitFiles,
  };
}

// ============================================
// Content Builders
// ============================================

/**
 * 단일 SPEC 콘텐츠 빌드
 */
function buildSpecContent(
  prd: ParsedPRD,
  featureName: string,
  phases: PhaseInfo[],
  options: SpecGeneratorOptions
): string {
  const { techStack = [], relatedCodePaths = [], designReference, additionalConstraints = [], additionalOutputs = [] } = options;
  const now = new Date().toISOString();

  let content = `---
status: pending
currentPhase: 0
totalPhases: ${phases.length}
createdAt: ${now}
lastUpdated: ${now}
---

# SPEC: ${featureName}

## Persona
<role>
Senior developer implementing ${featureName}.
- Follow existing code patterns and conventions
- Write testable, maintainable code
- Consider security and performance implications
</role>

## Context
<context>
### Background
${prd.description || `Implementation of ${prd.title}`}

### Tech Stack
${techStack.length > 0 ? techStack.map(t => `- ${t}`).join('\n') : '- (To be determined based on project)'}

### Related Code
${relatedCodePaths.length > 0 ? relatedCodePaths.map(p => `- \`${p}\``).join('\n') : '- (Analyze existing codebase for patterns)'}

### Design Reference
${designReference || '- (None specified)'}

### Requirements Source
- Parsed from PRD: ${prd.requirements.length} requirements
- Format: ${prd.metadata.format}
</context>

## Task
<task>
`;

  // Phase별 태스크 추가
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    content += `### Phase ${i + 1}: ${phase.name}\n`;
    content += `**Goal**: ${getPhaseGoal(phase)}\n\n`;

    for (const task of phase.tasks) {
      content += `1. [ ] ${task}\n`;
    }
    content += '\n';
  }

  content += `</task>

## Constraints
<constraints>
### Must Follow
- Follow existing code patterns (ES Module, async/await)
- Maintain backward compatibility
- TypeScript strict mode compliance
- No \`any\` type → Use \`unknown\` + type guards
- Functions ≤30 lines recommended, ≤50 lines max
- Nesting ≤3 levels

### Error Handling
- Proper try-catch with meaningful error messages
- Loading state handling for async operations
- User-friendly error messages

### Security
- Input validation for all user inputs
- Authentication/authorization checks where needed
- No sensitive data in logs
${additionalConstraints.map(c => `\n- ${c}`).join('')}
</constraints>

## Output Format
<output_format>
### Files to Create
${generateFileList(phases, 'create')}

### Files to Modify
${generateFileList(phases, 'modify')}

### Verification Commands
- \`npm run build\` (build success)
- \`npm test\` (tests pass)
- \`tsc --noEmit\` (type check)
${additionalOutputs.map(o => `- ${o}`).join('\n')}
</output_format>

## Acceptance Criteria
<acceptance>
`;

  // 요구사항별 AC 추가
  for (const req of prd.requirements) {
    content += `### ${req.id}: ${truncateText(req.description, 60)}\n`;
    if (req.acceptanceCriteria.length > 0) {
      for (const ac of req.acceptanceCriteria) {
        content += `- [ ] ${ac}\n`;
      }
    } else {
      content += `- [ ] ${req.description} - implemented and verified\n`;
    }
    content += '\n';
  }

  content += `### Build & Test
- [ ] \`npm run build\` succeeds
- [ ] All tests pass
- [ ] No TypeScript errors
</acceptance>
`;

  return content;
}

/**
 * 마스터 SPEC 콘텐츠 빌드 (분할용)
 */
function buildMasterSpecContent(
  prd: ParsedPRD,
  featureName: string,
  phases: PhaseInfo[],
  options: SpecGeneratorOptions
): string {
  const now = new Date().toISOString();

  let content = `---
status: pending
currentPhase: 0
totalPhases: ${phases.length}
createdAt: ${now}
lastUpdated: ${now}
isMaster: true
---

# SPEC: ${featureName} (Master)

## Overview
- **Feature**: ${prd.title}
- **Total Phases**: ${phases.length}
- **Total Requirements**: ${prd.requirements.length}
- **Format**: Split SPEC (large scope)

## Sub-SPECs

| Order | SPEC File | Description | Status |
|-------|-----------|-------------|--------|
`;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const fileName = `phase-${i + 1}-${normalizeFileName(phase.name)}.md`;
    content += `| ${i + 1} | ${fileName} | ${phase.name} | ⬜ |\n`;
  }

  content += `
## Shared Context

### Tech Stack
${options.techStack?.map(t => `- ${t}`).join('\n') || '- (See project configuration)'}

### Constraints (Apply to All Phases)
- Follow existing code patterns
- TypeScript strict mode
- No \`any\` type
- Functions ≤50 lines max
${options.additionalConstraints?.map(c => `- ${c}`).join('\n') || ''}

## Execution Order
\`\`\`
${phases.map((p, i) => `Phase ${i + 1}: ${p.name}`).join(' → ')}
\`\`\`

## Dependencies
${generateDependencyList(phases)}
`;

  return content;
}

/**
 * Phase별 SPEC 콘텐츠 빌드
 */
function buildPhaseSpecContent(
  prd: ParsedPRD,
  featureName: string,
  phase: PhaseInfo,
  phaseNumber: number,
  totalPhases: number,
  options: SpecGeneratorOptions
): string {
  const now = new Date().toISOString();

  let content = `---
status: pending
phase: ${phaseNumber}
totalPhases: ${totalPhases}
masterSpec: _index.md
createdAt: ${now}
lastUpdated: ${now}
---

# SPEC: ${featureName} - Phase ${phaseNumber}: ${phase.name}

## Persona
<role>
Developer implementing Phase ${phaseNumber} of ${featureName}.
- Focus on ${phase.name}
- Follow project conventions
- Write testable code
</role>

## Context
<context>
### Phase Goal
${getPhaseGoal(phase)}

### Requirements (${phase.requirements.length})
${phase.requirements.map(r => `- ${r.id}: ${truncateText(r.description, 50)}`).join('\n')}

### Dependencies
${phaseNumber > 1 ? `- Requires Phase ${phaseNumber - 1} completion` : '- No dependencies (first phase)'}
</context>

## Task
<task>
`;

  for (const task of phase.tasks) {
    content += `1. [ ] ${task}\n`;
  }

  content += `</task>

## Acceptance Criteria
<acceptance>
`;

  for (const req of phase.requirements) {
    content += `- [ ] ${req.id}: ${truncateText(req.description, 60)}\n`;
  }

  content += `- [ ] Phase ${phaseNumber} build succeeds
- [ ] Phase ${phaseNumber} tests pass
</acceptance>
`;

  return content;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 요구사항을 Phase로 그룹화
 */
function groupRequirementsIntoPhases(
  requirements: Requirement[],
  threshold: number
): PhaseInfo[] {
  if (requirements.length <= threshold) {
    return [{
      name: 'Implementation',
      requirements,
      tasks: requirements.map(r => generateTaskFromRequirement(r)),
    }];
  }

  // 우선순위별 그룹화
  const high = requirements.filter(r => r.priority === 'high');
  const medium = requirements.filter(r => r.priority === 'medium');
  const low = requirements.filter(r => r.priority === 'low');

  const phases: PhaseInfo[] = [];

  // Phase 1: 설정/기반
  const setupReqs = requirements.slice(0, Math.ceil(threshold / 2));
  if (setupReqs.length > 0) {
    phases.push({
      name: 'Setup & Foundation',
      requirements: setupReqs,
      tasks: setupReqs.map(r => generateTaskFromRequirement(r)),
    });
  }

  // Phase 2+: 핵심 기능 (high priority)
  if (high.length > 0) {
    phases.push({
      name: 'Core Features',
      requirements: high,
      tasks: high.map(r => generateTaskFromRequirement(r)),
    });
  }

  // Phase 3+: 중요 기능 (medium priority)
  const remainingMedium = medium.filter(r => !setupReqs.includes(r));
  if (remainingMedium.length > 0) {
    phases.push({
      name: 'Additional Features',
      requirements: remainingMedium,
      tasks: remainingMedium.map(r => generateTaskFromRequirement(r)),
    });
  }

  // Phase 4+: 부가 기능 (low priority)
  if (low.length > 0) {
    phases.push({
      name: 'Enhancements',
      requirements: low,
      tasks: low.map(r => generateTaskFromRequirement(r)),
    });
  }

  // 마지막 Phase: 테스트 & 검증
  phases.push({
    name: 'Testing & Verification',
    requirements: [],
    tasks: [
      'Write unit tests for all new code',
      'Write integration tests',
      'Update documentation',
      'Final verification and cleanup',
    ],
  });

  return phases;
}

/**
 * 요구사항에서 태스크 생성
 */
function generateTaskFromRequirement(req: Requirement): string {
  const desc = truncateText(req.description, 80);
  return `${req.id}: ${desc}\n   - Verify: Test coverage for this requirement`;
}

/**
 * Phase 목표 추출
 */
function getPhaseGoal(phase: PhaseInfo): string {
  if (phase.requirements.length === 0) {
    return phase.name;
  }
  const firstReq = phase.requirements[0];
  return truncateText(firstReq.description, 100);
}

/**
 * 파일 목록 생성
 */
function generateFileList(phases: PhaseInfo[], type: 'create' | 'modify'): string {
  // 실제로는 요구사항을 분석해서 추론해야 하지만, 기본 템플릿 제공
  if (type === 'create') {
    return `- (To be determined based on implementation)
- \`src/[feature]/index.ts\`
- \`src/[feature]/[feature].test.ts\``;
  }
  return `- (Analyze existing codebase)
- Relevant existing files`;
}

/**
 * 의존성 목록 생성
 */
function generateDependencyList(phases: PhaseInfo[]): string {
  if (phases.length <= 1) {
    return '- No inter-phase dependencies';
  }

  let deps = '';
  for (let i = 1; i < phases.length; i++) {
    deps += `- Phase ${i + 1} depends on Phase ${i}\n`;
  }
  return deps;
}

/**
 * 파일명 정규화
 */
function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

/**
 * 텍스트 자르기
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
