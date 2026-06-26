/**
 * 상수 데이터
 */

// ─── 스킬 설치 범위 분류 ───

/**
 * 전역 설치 스킬 (postinstall → ~/.claude/skills/) — 티어 기반 분류
 *
 * core: 실제 버그/실수를 방지하는 안전망 — 항상 활성
 * standard: 워크플로우 지원 — 프로젝트 설정 시 선택 활성
 * optional: 참고/래퍼 — 명시적 호출 시에만 로드 (전역 설치에서 제외)
 */
/**
 * 도트 진입점 스킬 (예: vibe.spec)
 * Claude Code에서는 slash-style 진입점으로, Codex에서는 `/skills` 또는 `$vibe.spec`로 호출된다.
 */
export const GLOBAL_SKILLS_ENTRY: ReadonlyArray<string> = [
  'vibe',
  'vibe.analyze',
  'vibe.clone',
  'vibe.contract',
  'vibe.design',
  'vibe.docs',
  'vibe.event',
  'vibe.figma',
  'vibe.harness',
  'vibe.loop',
  'vibe.reason',
  'vibe.regress',
  'vibe.review',
  'vibe.run',
  'vibe.scaffold',
  'vibe.spec',
  'vibe.test',
  'vibe.trace',
  'vibe.utils',
  'vibe.verify',
];

export const GLOBAL_SKILLS_CORE: ReadonlyArray<string> = [
  'interview',
  'plan',
  'spec',
  'spec-review',
  'test',
  'techdebt',
  'characterization-test',
  'arch-guard',
  'exec-plan',
  'rob-pike',
  'yagni-ladder',
  'systematic-debugging',
];

export const GLOBAL_SKILLS_STANDARD: ReadonlyArray<string> = [
  'parallel-research',
  'handoff',
  'priority-todos',
  'agents-md',
  'claude-md-guide',
  'capability-loop',
  'design-teach',
  'figma',
  'figma-extract',
  'figma-convert',
  'clone',
  'docs',
];

/** 전역 설치에서 제외된 스킬 (명시적 /skill-name 호출 시에만 활성)
 *  사유: 표준 도구 래퍼이거나 구체성 부족 — 직접 프롬프트가 더 효과적 */
export const GLOBAL_SKILLS_OPTIONAL: ReadonlyArray<string> = [
  'commit-push-pr',
  'git-worktree',
  'tool-fallback',
  'context7-usage',
  'chub-usage',
  'presentation',
];

/** 전역 설치 스킬 전체 (하위 호환용) */
export const GLOBAL_SKILLS: ReadonlyArray<string> = [
  ...GLOBAL_SKILLS_ENTRY,
  ...GLOBAL_SKILLS_CORE,
  ...GLOBAL_SKILLS_STANDARD,
];

/** 스택 → 로컬 스킬 매핑 (vibe init/update → .claude/skills/) */
export const STACK_TO_SKILLS: Record<string, ReadonlyArray<string>> = {
  // TypeScript 공통
  'typescript': ['typescript-advanced-types'],
  // Web frontend → UI/UX + SEO + Design steering + React best practices
  'typescript-react': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'vercel-react-best-practices', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  'typescript-nextjs': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'vercel-react-best-practices', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  'typescript-vue': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  'typescript-nuxt': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  'typescript-svelte': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  'typescript-angular': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  'typescript-astro': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill', 'vibe.design'],
  // Mobile → UI + design-audit/critique only (polish/normalize/distill are CSS-based)
  'typescript-react-native': ['ui-ux-pro-max', 'design-audit', 'design-critique', 'vibe.design'],
  'dart-flutter': ['ui-ux-pro-max', 'design-audit', 'design-critique', 'vibe.design'],
  'swift-ios': ['ui-ux-pro-max', 'design-audit', 'design-critique', 'vibe.design'],
  'kotlin-android': ['ui-ux-pro-max', 'design-audit', 'design-critique', 'vibe.design'],
};

/** Capability → 로컬 스킬 매핑 (의존성 감지 기반 자동 설치) */
export const CAPABILITY_SKILLS: Record<string, ReadonlyArray<string>> = {
  'commerce': ['commerce-patterns', 'e2e-commerce'],
  'video': ['video-production'],
  'event-automation': ['event-planning', 'event-comms', 'event-ops'],
  'pm': ['create-prd', 'prioritization-frameworks', 'user-personas'],
  'devlog': ['devlog'],
};

/** 스택 → 외부 스킬(skills.sh) 매핑 (vibe init/update → npx skills add) */
export const STACK_TO_EXTERNAL_SKILLS: Record<string, ReadonlyArray<string>> = {
  'typescript-react': ['vercel-labs/agent-skills'],
  'typescript-nextjs': ['vercel-labs/agent-skills', 'vercel-labs/next-skills'],
};

/** Capability → 외부 스킬(skills.sh) 매핑 */
export const CAPABILITY_EXTERNAL_SKILLS: Record<string, ReadonlyArray<string>> = {};

/** 사용자 선택 가능한 capability 목록 (vibe init 인터랙티브 프롬프트용) */
export const AVAILABLE_CAPABILITIES: ReadonlyArray<{
  value: string;
  label: string;
  hint: string;
}> = [
  { value: 'commerce', label: 'Commerce / Payments', hint: 'Stripe, Shopify, PayPal 등' },
  { value: 'video', label: 'Video Production', hint: 'FFmpeg, 트랜스코딩, 스트리밍 등' },
  { value: 'event-automation', label: 'Event Automation', hint: '커뮤니티 행사 자동화 (밋업, 웨비나, 컨퍼런스)' },
  { value: 'pm', label: 'Product Management', hint: 'PRD, 우선순위, 페르소나 등' },
  { value: 'devlog', label: 'Dev Log Automation', hint: '커밋 기반 개발일지 자동 생성 + 블로그 레포 연동' },
];

/**
 * 스택 타입 + capabilities → 로컬 설치할 스킬 목록 결정
 */
export function resolveLocalSkills(stackTypes: string[], capabilities: string[] = []): string[] {
  const skills = new Set<string>();

  // 스택 기반 스킬
  for (const stack of stackTypes) {
    // exact match (e.g., 'typescript-react')
    const exact = STACK_TO_SKILLS[stack];
    if (exact) exact.forEach(s => skills.add(s));
    // prefix match (e.g., 'typescript' from 'typescript-react')
    const prefix = stack.split('-')[0];
    if (prefix !== stack) {
      const prefixSkills = STACK_TO_SKILLS[prefix];
      if (prefixSkills) prefixSkills.forEach(s => skills.add(s));
    }
  }

  // Capability 기반 스킬
  for (const cap of capabilities) {
    const capSkills = CAPABILITY_SKILLS[cap];
    if (capSkills) capSkills.forEach(s => skills.add(s));
  }

  return [...skills];
}

/**
 * 스택 타입 + capabilities → 외부 스킬(skills.sh) 목록 결정
 */
export function resolveExternalSkills(stackTypes: string[], capabilities: string[] = []): string[] {
  const skills = new Set<string>();

  for (const stack of stackTypes) {
    const exact = STACK_TO_EXTERNAL_SKILLS[stack];
    if (exact) exact.forEach(s => skills.add(s));
    const prefix = stack.split('-')[0];
    if (prefix !== stack) {
      const prefixSkills = STACK_TO_EXTERNAL_SKILLS[prefix];
      if (prefixSkills) prefixSkills.forEach(s => skills.add(s));
    }
  }

  for (const cap of capabilities) {
    const capSkills = CAPABILITY_EXTERNAL_SKILLS[cap];
    if (capSkills) capSkills.forEach(s => skills.add(s));
  }

  return [...skills];
}

// ─── 에이전트 선택 설치 (그룹 = agents/ 하위 디렉토리명) ───

/**
 * 조건부 에이전트 그룹 — 전역 postinstall에서 제외하고,
 * vibe init/update 시 스택/capability 매칭될 때만 프로젝트 로컬(.claude/agents/)에 설치.
 *
 * WHY: 에이전트 description은 매 턴 Agent tool schema에 열거되어 상시 컨텍스트를
 * 점유한다. UI/Figma/Event 에이전트(18개)는 해당 스택·capability 프로젝트에서만
 * 의미가 있으므로 전역에서 빼면 비해당 프로젝트의 세션당 수백 토큰이 절약된다.
 */
export const CONDITIONAL_AGENT_GROUPS: ReadonlyArray<string> = ['ui', 'figma', 'event'];

/** 스택 → 에이전트 그룹 매핑 (vibe init/update → .claude/agents/) */
export const STACK_TO_AGENT_GROUPS: Record<string, ReadonlyArray<string>> = {
  'typescript-react': ['ui', 'figma'],
  'typescript-nextjs': ['ui', 'figma'],
  'typescript-vue': ['ui', 'figma'],
  'typescript-nuxt': ['ui', 'figma'],
  'typescript-svelte': ['ui', 'figma'],
  'typescript-angular': ['ui', 'figma'],
  'typescript-astro': ['ui', 'figma'],
  'typescript-react-native': ['ui', 'figma'],
  'dart-flutter': ['ui', 'figma'],
};

/** capability → 에이전트 그룹 매핑 */
export const CAPABILITY_AGENT_GROUPS: Record<string, ReadonlyArray<string>> = {
  'event-automation': ['event'],
};

/**
 * 스택 타입 + capabilities → 로컬 설치할 에이전트 그룹 결정
 * (resolveLocalSkills와 동일한 exact + prefix 매칭 규칙)
 */
export function resolveLocalAgentGroups(stackTypes: string[], capabilities: string[] = []): string[] {
  const groups = new Set<string>();

  for (const stack of stackTypes) {
    const exact = STACK_TO_AGENT_GROUPS[stack];
    if (exact) exact.forEach(g => groups.add(g));
    const prefix = stack.split('-')[0];
    if (prefix !== stack) {
      const prefixGroups = STACK_TO_AGENT_GROUPS[prefix];
      if (prefixGroups) prefixGroups.forEach(g => groups.add(g));
    }
  }

  for (const cap of capabilities) {
    const capGroups = CAPABILITY_AGENT_GROUPS[cap];
    if (capGroups) capGroups.forEach(g => groups.add(g));
  }

  return [...groups];
}

// ─── 스택 타입 → 언어 룰 파일 매핑 ───

// 스택 타입 → 언어 룰 파일 매핑
export const STACK_TO_LANGUAGE_FILE: Record<string, string> = {
  'typescript-nextjs': 'typescript-nextjs.md',
  'typescript-react': 'typescript-react.md',
  'typescript-react-native': 'typescript-react-native.md',
  'typescript-nuxt': 'typescript-nuxt.md',
  'typescript-vue': 'typescript-vue.md',
  'typescript-node': 'typescript-node.md',
  'typescript-angular': 'typescript-angular.md',
  'typescript-svelte': 'typescript-svelte.md',
  'typescript-astro': 'typescript-astro.md',
  'typescript-nestjs': 'typescript-nestjs.md',
  'typescript-tauri': 'typescript-tauri.md',
  'typescript-electron': 'typescript-electron.md',
  'python-fastapi': 'python-fastapi.md',
  'python-django': 'python-django.md',
  'python': 'python-fastapi.md', // fallback
  'dart-flutter': 'dart-flutter.md',
  'go': 'go.md',
  'rust': 'rust.md',
  'kotlin-android': 'kotlin-android.md',
  'kotlin': 'kotlin-android.md', // fallback
  'java-spring': 'java-spring.md',
  'java': 'java-spring.md', // fallback
  'swift-ios': 'swift-ios.md',
  'ruby-rails': 'ruby-rails.md',
  'csharp-unity': 'csharp-unity.md',
  'gdscript-godot': 'gdscript-godot.md',
};

// 언어 룰 파일 → glob 패턴 매핑
export const LANGUAGE_GLOBS: Record<string, string> = {
  'typescript-nextjs.md': '**/*.ts,**/*.tsx,**/next.config.*',
  'typescript-react.md': '**/*.ts,**/*.tsx,**/*.jsx',
  'typescript-react-native.md': '**/*.ts,**/*.tsx',
  'typescript-nuxt.md': '**/*.ts,**/*.vue,**/nuxt.config.*',
  'typescript-vue.md': '**/*.ts,**/*.vue',
  'typescript-node.md': '**/*.ts,**/*.mts',
  'typescript-angular.md': '**/*.ts,**/*.component.ts',
  'typescript-svelte.md': '**/*.ts,**/*.svelte',
  'typescript-astro.md': '**/*.ts,**/*.astro',
  'typescript-nestjs.md': '**/*.ts,**/*.module.ts,**/*.controller.ts,**/*.service.ts',
  'typescript-tauri.md': '**/*.ts,**/*.tsx,**/tauri.conf.json',
  'typescript-electron.md': '**/*.ts,**/*.tsx',
  'python-fastapi.md': '**/*.py',
  'python-django.md': '**/*.py',
  'dart-flutter.md': '**/*.dart',
  'go.md': '**/*.go',
  'rust.md': '**/*.rs',
  'kotlin-android.md': '**/*.kt,**/*.kts',
  'java-spring.md': '**/*.java',
  'swift-ios.md': '**/*.swift',
  'ruby-rails.md': '**/*.rb,**/*.erb',
  'csharp-unity.md': '**/*.cs',
  'gdscript-godot.md': '**/*.gd',
};

// Cursor 모델 매핑 (각 리뷰어 유형에 최적의 모델)
// 사용 가능: composer-1, claude-4.5-opus-high, claude-4.5-opus-high-thinking,
//           claude-4.5-sonnet-thinking, gpt-5.5, gpt-5.5-pro, gpt-5.3-codex,
//           antigravity-pro, antigravity-fast
export const CURSOR_MODEL_MAPPING: Record<string, string> = {
  // 보안/아키텍처: 깊은 추론 필요 → thinking 모델
  'security-reviewer': 'claude-4.5-sonnet-thinking',
  'architecture-reviewer': 'claude-4.5-sonnet-thinking',
  'data-integrity-reviewer': 'claude-4.5-sonnet-thinking',

  // 언어별 전문가: 코드 이해 필요 → codex
  'typescript-reviewer': 'gpt-5.3-codex',
  'python-reviewer': 'gpt-5.3-codex',
  'react-reviewer': 'gpt-5.3-codex',
  'rails-reviewer': 'gpt-5.3-codex',

  // 빠른 패턴 체크: 경량 모델
  'performance-reviewer': 'antigravity-fast',
  'complexity-reviewer': 'antigravity-fast',
  'simplicity-reviewer': 'antigravity-fast',
  'test-coverage-reviewer': 'antigravity-fast',
  'git-history-reviewer': 'antigravity-fast',
};

// 언어 룰 파일 접두사 (이 접두사로 시작하는 .mdc는 core에서 관리)
export const LANGUAGE_RULE_PREFIXES = [
  'typescript-', 'python-', 'dart-', 'go.', 'rust.', 'kotlin-',
  'java-', 'swift-', 'ruby-', 'csharp-', 'gdscript-'
];

// 레거시 파일명 (정리 대상)
export const LEGACY_RULE_FILES = [
  'react-patterns.mdc', 'typescript-standards.mdc', 'python-standards.mdc'
];

/** 이전 네이밍에서 변경된 스킬 — postinstall 시 구 디렉토리 삭제 */
export const LEGACY_SKILL_DIRS: ReadonlyArray<string> = [
  // 도트 네이밍 (v1)
  'vibe.spec',
  'vibe.spec.review',
  'vibe.docs',
  'vibe.figma',
  'vibe.figma.convert',
  'vibe.figma.extract',
  'vibe.interview',
  'vibe.plan',
  'vibe.discover',
  // 대시 네이밍 (v2 figma 분기)
  'vibe-figma-analyze',
  'vibe-figma-codegen',
  'vibe-figma-consolidate',
  'vibe-figma-frame',
  'vibe-figma-pipeline',
  'vibe-figma-rules',
  'vibe-figma-style',
  // 대시 네이밍 (v3 vibe- prefix 제거 → plain name)
  'vibe-clone',
  'vibe-contract',
  'vibe-docs',
  'vibe-figma',
  'vibe-figma-convert',
  'vibe-figma-extract',
  'vibe-interview',
  'vibe-plan',
  'vibe-regress',
  'vibe-spec',
  'vibe-spec-review',
  'vibe-test',
];

// ─── Claude Code 네이티브 서브에이전트 매핑 ───

// Claude Code 모델 매핑 (사용 가능: sonnet, opus, haiku, inherit)
export const CLAUDE_MODEL_MAPPING: Record<string, string> = {
  // Explorer tier
  'explorer': 'haiku',
  'explorer-low': 'haiku',
  'explorer-medium': 'sonnet',
  // Implementer tier
  'implementer': 'sonnet',
  'implementer-low': 'haiku',
  'implementer-medium': 'sonnet',
  // Architect tier
  'architect': 'opus',
  'architect-low': 'haiku',
  'architect-medium': 'sonnet',
  // Review agents — sonnet for quality gate accuracy
  'security-reviewer': 'sonnet',
  'architecture-reviewer': 'sonnet',
  'performance-reviewer': 'sonnet',
  'complexity-reviewer': 'sonnet',
  'simplicity-reviewer': 'sonnet',
  'data-integrity-reviewer': 'sonnet',
  'test-coverage-reviewer': 'sonnet',
  'git-history-reviewer': 'sonnet',
  'python-reviewer': 'sonnet',
  'typescript-reviewer': 'sonnet',
  'rails-reviewer': 'sonnet',
  'react-reviewer': 'sonnet',
  // Research agents
  'best-practices': 'haiku',
  'framework-docs': 'haiku',
  'codebase-patterns': 'haiku',
  'security-advisory': 'haiku',
  // Utility agents
  'searcher': 'haiku',
  'tester': 'haiku',
  'simplifier': 'sonnet',
  'refactor-cleaner': 'sonnet',
  'build-error-resolver': 'sonnet',
  'compounder': 'sonnet',
  'diagrammer': 'haiku',
  'e2e-tester': 'sonnet',
  'ui-previewer': 'sonnet',
  'junior-mentor': 'sonnet',
  // QA agents
  'qa-coordinator': 'sonnet',
  'edge-case-finder': 'haiku',
  'acceptance-tester': 'haiku',
  // Planning agents
  'requirements-analyst': 'haiku',
  'ux-advisor': 'haiku',
  // Docs agents
  'api-documenter': 'haiku',
  'changelog-writer': 'haiku',
  // Event agents
  'event-scheduler': 'sonnet',
  'event-content': 'sonnet',
  'event-speaker': 'haiku',
  'event-comms': 'sonnet',
  'event-ops': 'sonnet',
  'event-image': 'haiku',
  // Figma agents (teams/figma)
  'figma-analyst': 'sonnet',
  'figma-architect': 'sonnet',
  'figma-builder': 'sonnet',
  'figma-auditor': 'sonnet',
  // UI agents
  'ui-a11y-auditor': 'sonnet',
  'ui-antipattern-detector': 'sonnet',
  'ui-dataviz-advisor': 'haiku',
  'ui-design-system-gen': 'sonnet',
  'ui-industry-analyzer': 'haiku',
  'ui-layout-architect': 'sonnet',
  'ui-stack-implementer': 'sonnet',
  'ux-compliance-reviewer': 'sonnet',
  // Team coordinators
  'debug-team': 'sonnet',
  'dev-team': 'sonnet',
  'docs-team': 'sonnet',
  'figma-team': 'sonnet',
  'fullstack-team': 'sonnet',
  'lite-team': 'sonnet',
  'migration-team': 'sonnet',
  'refactor-team': 'sonnet',
  'research-team': 'sonnet',
  'review-debate-team': 'sonnet',
  'security-team': 'sonnet',
};

// Claude Code 에이전트 도구 세트 정의
export const CLAUDE_AGENT_TOOLS: Record<string, string[]> = {
  'read-only': ['Read', 'Glob', 'Grep'],
  'read-only-git': ['Read', 'Glob', 'Grep', 'Bash'],
  'write-capable': ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  'web-search': ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
};

// 에이전트 → 도구 카테고리 매핑
export const CLAUDE_AGENT_TOOL_CATEGORY: Record<string, string> = {
  // Explorer — read-only
  'explorer': 'read-only',
  'explorer-low': 'read-only',
  'explorer-medium': 'read-only',
  // Implementer — write-capable
  'implementer': 'write-capable',
  'implementer-low': 'write-capable',
  'implementer-medium': 'write-capable',
  // Architect — read-only
  'architect': 'read-only',
  'architect-low': 'read-only',
  'architect-medium': 'read-only',
  // Review agents — read-only
  'security-reviewer': 'read-only',
  'architecture-reviewer': 'read-only',
  'performance-reviewer': 'read-only',
  'complexity-reviewer': 'read-only',
  'simplicity-reviewer': 'read-only',
  'data-integrity-reviewer': 'read-only',
  'test-coverage-reviewer': 'read-only',
  'git-history-reviewer': 'read-only-git',
  'python-reviewer': 'read-only',
  'typescript-reviewer': 'read-only',
  'rails-reviewer': 'read-only',
  'react-reviewer': 'read-only',
  // Research agents
  'best-practices': 'web-search',
  'framework-docs': 'web-search',
  'codebase-patterns': 'read-only',
  'security-advisory': 'web-search',
  // Utility agents
  'searcher': 'web-search',
  'tester': 'write-capable',
  'simplifier': 'write-capable',
  'refactor-cleaner': 'write-capable',
  'build-error-resolver': 'write-capable',
  'compounder': 'write-capable',
  'diagrammer': 'write-capable',
  'e2e-tester': 'write-capable',
  'ui-previewer': 'write-capable',
  'junior-mentor': 'write-capable',
  // QA agents — read-only
  'qa-coordinator': 'read-only',
  'edge-case-finder': 'read-only',
  'acceptance-tester': 'read-only',
  // Planning agents — read-only
  'requirements-analyst': 'read-only',
  'ux-advisor': 'read-only',
  // Docs agents
  'api-documenter': 'read-only',
  'changelog-writer': 'read-only-git',
  // Event agents
  'event-scheduler': 'write-capable',
  'event-content': 'write-capable',
  'event-speaker': 'web-search',
  'event-comms': 'write-capable',
  'event-ops': 'write-capable',
  'event-image': 'write-capable',
  // Figma agents
  'figma-analyst': 'read-only',
  'figma-architect': 'read-only',
  'figma-builder': 'write-capable',
  'figma-auditor': 'read-only-git',
  // UI agents
  'ui-a11y-auditor': 'read-only',
  'ui-antipattern-detector': 'read-only',
  'ui-dataviz-advisor': 'read-only',
  'ui-design-system-gen': 'write-capable',
  'ui-industry-analyzer': 'read-only',
  'ui-layout-architect': 'read-only',
  'ui-stack-implementer': 'read-only',
  'ux-compliance-reviewer': 'read-only',
  // Team coordinators (read-only — 호출만 하고 코드 수정은 멤버 agent에 위임)
  'debug-team': 'read-only',
  'dev-team': 'read-only',
  'docs-team': 'read-only',
  'figma-team': 'read-only',
  'fullstack-team': 'read-only',
  'lite-team': 'read-only',
  'migration-team': 'read-only',
  'refactor-team': 'read-only',
  'research-team': 'read-only',
  'review-debate-team': 'read-only',
  'security-team': 'read-only',
};

// 에이전트 → 권한 모드 매핑
export const CLAUDE_AGENT_PERMISSION_MODE: Record<string, string> = {
  // 읽기 전용 에이전트 → plan
  'explorer': 'plan', 'explorer-low': 'plan', 'explorer-medium': 'plan',
  'architect': 'plan', 'architect-low': 'plan', 'architect-medium': 'plan',
  'security-reviewer': 'plan', 'architecture-reviewer': 'plan',
  'performance-reviewer': 'plan', 'complexity-reviewer': 'plan',
  'simplicity-reviewer': 'plan', 'data-integrity-reviewer': 'plan',
  'test-coverage-reviewer': 'plan', 'git-history-reviewer': 'plan',
  'python-reviewer': 'plan', 'typescript-reviewer': 'plan',
  'rails-reviewer': 'plan', 'react-reviewer': 'plan',
  'best-practices': 'plan', 'framework-docs': 'plan',
  'codebase-patterns': 'plan', 'security-advisory': 'plan',
  'qa-coordinator': 'plan', 'edge-case-finder': 'plan', 'acceptance-tester': 'plan',
  'requirements-analyst': 'plan', 'ux-advisor': 'plan',
  'api-documenter': 'plan', 'changelog-writer': 'plan',
  'searcher': 'plan',
  // 수정 가능 에이전트 → acceptEdits
  'implementer': 'acceptEdits', 'implementer-low': 'acceptEdits', 'implementer-medium': 'acceptEdits',
  'tester': 'acceptEdits', 'simplifier': 'acceptEdits',
  'refactor-cleaner': 'acceptEdits', 'build-error-resolver': 'acceptEdits',
  'compounder': 'acceptEdits', 'diagrammer': 'acceptEdits',
  'e2e-tester': 'acceptEdits', 'ui-previewer': 'acceptEdits',
  'junior-mentor': 'acceptEdits',
  // Event agents
  'event-scheduler': 'acceptEdits',
  'event-content': 'acceptEdits',
  'event-speaker': 'plan',
  'event-comms': 'acceptEdits',
  'event-ops': 'acceptEdits',
  'event-image': 'acceptEdits',
  // Figma agents
  'figma-analyst': 'plan',
  'figma-architect': 'plan',
  'figma-builder': 'acceptEdits',
  'figma-auditor': 'plan',
  // UI agents
  'ui-a11y-auditor': 'plan',
  'ui-antipattern-detector': 'plan',
  'ui-dataviz-advisor': 'plan',
  'ui-design-system-gen': 'acceptEdits',
  'ui-industry-analyzer': 'plan',
  'ui-layout-architect': 'plan',
  'ui-stack-implementer': 'plan',
  'ux-compliance-reviewer': 'plan',
  // Team coordinators
  'debug-team': 'plan',
  'dev-team': 'plan',
  'docs-team': 'plan',
  'figma-team': 'plan',
  'fullstack-team': 'plan',
  'lite-team': 'plan',
  'migration-team': 'plan',
  'refactor-team': 'plan',
  'research-team': 'plan',
  'review-debate-team': 'plan',
  'security-team': 'plan',
};

// NO FILE CREATION 에이전트 → Write, Edit 차단
export const CLAUDE_AGENT_DISALLOWED_TOOLS: Record<string, string[]> = {
  'requirements-analyst': ['Write', 'Edit'],
  'ux-advisor': ['Write', 'Edit'],
  'qa-coordinator': ['Write', 'Edit'],
  'edge-case-finder': ['Write', 'Edit'],
  'acceptance-tester': ['Write', 'Edit'],
  'best-practices': ['Write', 'Edit'],
  'framework-docs': ['Write', 'Edit'],
  'codebase-patterns': ['Write', 'Edit'],
  'security-advisory': ['Write', 'Edit'],
  'api-documenter': ['Write', 'Edit'],
  'changelog-writer': ['Write', 'Edit'],
  'event-speaker': ['Write', 'Edit'],
  // Read-only analysts (자문/감지/분석 — 코드 수정 금지)
  'ui-a11y-auditor': ['Write', 'Edit'],
  'ui-antipattern-detector': ['Write', 'Edit'],
  'ui-dataviz-advisor': ['Write', 'Edit'],
  'ui-industry-analyzer': ['Write', 'Edit'],
  'ui-layout-architect': ['Write', 'Edit'],
  'ui-stack-implementer': ['Write', 'Edit'],
  'ux-compliance-reviewer': ['Write', 'Edit'],
  'figma-analyst': ['Write', 'Edit'],
  'figma-architect': ['Write', 'Edit'],
  'figma-auditor': ['Write', 'Edit'],
  // Team coordinators — read-only orchestration
  'debug-team': ['Write', 'Edit'],
  'dev-team': ['Write', 'Edit'],
  'docs-team': ['Write', 'Edit'],
  'figma-team': ['Write', 'Edit'],
  'fullstack-team': ['Write', 'Edit'],
  'lite-team': ['Write', 'Edit'],
  'migration-team': ['Write', 'Edit'],
  'refactor-team': ['Write', 'Edit'],
  'research-team': ['Write', 'Edit'],
  'review-debate-team': ['Write', 'Edit'],
  'security-team': ['Write', 'Edit'],
};

// 지속 메모리 설정 (세션 간 패턴 축적)
export const CLAUDE_AGENT_MEMORY: Record<string, string> = {
  'security-reviewer': 'user',
  'architecture-reviewer': 'user',
  'performance-reviewer': 'user',
  'complexity-reviewer': 'user',
  'simplicity-reviewer': 'user',
  'data-integrity-reviewer': 'user',
  'test-coverage-reviewer': 'user',
  'git-history-reviewer': 'user',
  'python-reviewer': 'user',
  'typescript-reviewer': 'user',
  'rails-reviewer': 'user',
  'react-reviewer': 'user',
};
