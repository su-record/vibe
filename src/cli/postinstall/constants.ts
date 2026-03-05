/**
 * 상수 데이터
 */

// ─── 스킬 설치 범위 분류 ───

/** 전역 설치 스킬 (postinstall → ~/.claude/skills/) — 모든 프로젝트에 공통 */
export const GLOBAL_SKILLS: ReadonlyArray<string> = [
  'core-capabilities',
  'parallel-research',
  'commit-push-pr',
  'git-worktree',
  'handoff',
  'priority-todos',
  'tool-fallback',
  'context7-usage',
  'techdebt',
  'characterization-test',
  'agents-md',
  'exec-plan',
  'arch-guard',
  'capability-loop',
];

/** 스택 → 로컬 스킬 매핑 (vibe init/update → .claude/skills/) */
export const STACK_TO_SKILLS: Record<string, ReadonlyArray<string>> = {
  // TypeScript 공통
  'typescript': ['typescript-advanced-types'],
  // Web frontend → UI/UX + SEO + React best practices
  'typescript-react': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'vercel-react-best-practices'],
  'typescript-nextjs': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'vercel-react-best-practices'],
  'typescript-vue': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist'],
  'typescript-nuxt': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist'],
  'typescript-svelte': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist'],
  'typescript-angular': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist'],
  'typescript-astro': ['frontend-design', 'ui-ux-pro-max', 'brand-assets', 'seo-checklist'],
  // Mobile → UI만
  'typescript-react-native': ['ui-ux-pro-max'],
  'dart-flutter': ['ui-ux-pro-max'],
  'swift-ios': ['ui-ux-pro-max'],
  'kotlin-android': ['ui-ux-pro-max'],
};

/** Capability → 로컬 스킬 매핑 (의존성 감지 기반 자동 설치) */
export const CAPABILITY_SKILLS: Record<string, ReadonlyArray<string>> = {
  'commerce': ['commerce-patterns', 'e2e-commerce'],
  'video': ['video-production'],
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
//           claude-4.5-sonnet-thinking, gpt-5.3-codex, gpt-5.2, gpt-5.2-high,
//           gemini-3-pro, gemini-3-flash
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
  'performance-reviewer': 'gemini-flash',
  'complexity-reviewer': 'gemini-flash',
  'simplicity-reviewer': 'gemini-flash',
  'test-coverage-reviewer': 'gemini-flash',
  'git-history-reviewer': 'gemini-flash',
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
  // Review agents — haiku for parallel speed
  'security-reviewer': 'haiku',
  'architecture-reviewer': 'haiku',
  'performance-reviewer': 'haiku',
  'complexity-reviewer': 'haiku',
  'simplicity-reviewer': 'haiku',
  'data-integrity-reviewer': 'haiku',
  'test-coverage-reviewer': 'haiku',
  'git-history-reviewer': 'haiku',
  'python-reviewer': 'haiku',
  'typescript-reviewer': 'haiku',
  'rails-reviewer': 'haiku',
  'react-reviewer': 'haiku',
  // Research agents
  'best-practices-agent': 'haiku',
  'framework-docs-agent': 'haiku',
  'codebase-patterns-agent': 'haiku',
  'security-advisory-agent': 'haiku',
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
  'edge-case-finder': 'haiku',
  'acceptance-tester': 'haiku',
  // Planning agents
  'requirements-analyst': 'haiku',
  'ux-advisor': 'haiku',
  // Docs agents
  'api-documenter': 'haiku',
  'changelog-writer': 'haiku',
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
  'best-practices-agent': 'web-search',
  'framework-docs-agent': 'web-search',
  'codebase-patterns-agent': 'read-only',
  'security-advisory-agent': 'web-search',
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
  'edge-case-finder': 'read-only',
  'acceptance-tester': 'read-only',
  // Planning agents — read-only
  'requirements-analyst': 'read-only',
  'ux-advisor': 'read-only',
  // Docs agents
  'api-documenter': 'read-only',
  'changelog-writer': 'read-only-git',
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
  'best-practices-agent': 'plan', 'framework-docs-agent': 'plan',
  'codebase-patterns-agent': 'plan', 'security-advisory-agent': 'plan',
  'edge-case-finder': 'plan', 'acceptance-tester': 'plan',
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
};

// NO FILE CREATION 에이전트 → Write, Edit 차단
export const CLAUDE_AGENT_DISALLOWED_TOOLS: Record<string, string[]> = {
  'requirements-analyst': ['Write', 'Edit'],
  'ux-advisor': ['Write', 'Edit'],
  'edge-case-finder': ['Write', 'Edit'],
  'acceptance-tester': ['Write', 'Edit'],
  'best-practices-agent': ['Write', 'Edit'],
  'framework-docs-agent': ['Write', 'Edit'],
  'codebase-patterns-agent': ['Write', 'Edit'],
  'security-advisory-agent': ['Write', 'Edit'],
  'api-documenter': ['Write', 'Edit'],
  'changelog-writer': ['Write', 'Edit'],
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
