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
  'vibe.continue',
  'vibe.contract',
  'vibe.design',
  'vibe.docs',
  'vibe.event',
  'vibe.figma',
  'vibe.harness',
  'vibe.image',
  'vibe.llm',
  'vibe.loop',
  'vibe.reason',
  'vibe.regress',
  'vibe.review',
  'vibe.run',
  'vibe.scaffold',
  'vibe.spec',
  'vibe.test',
  'vibe.trace',
  'vibe.verify',
];

export const GLOBAL_SKILLS_CORE: ReadonlyArray<string> = [
  'spec',
  'test',
  'arch-guard',
  'exec-plan',
  'restraint',
  'contract',
  'regress',
];

export const GLOBAL_SKILLS_STANDARD: ReadonlyArray<string> = [
  'parallel-research',
  'handoff',
  'priority-todos',
  'agents-md',
  'capability-loop',
  'design-teach',
  'figma',
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
  // Web frontend → UI/UX + SEO + Design steering + React best practices
  'typescript-react': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'vercel-react-best-practices', 'design-review', 'design-refine', 'vibe.design'],
  'typescript-nextjs': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'vercel-react-best-practices', 'design-review', 'design-refine', 'vibe.design'],
  'typescript-vue': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-review', 'design-refine', 'vibe.design'],
  'typescript-nuxt': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-review', 'design-refine', 'vibe.design'],
  'typescript-svelte': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-review', 'design-refine', 'vibe.design'],
  'typescript-angular': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-review', 'design-refine', 'vibe.design'],
  'typescript-astro': ['ui-ux-pro-max', 'brand-assets', 'seo-checklist', 'design-review', 'design-refine', 'vibe.design'],
  // Mobile → UI + design-review only (refine 파이프라인은 CSS 기반)
  'typescript-react-native': ['ui-ux-pro-max', 'design-review', 'vibe.design'],
  'dart-flutter': ['ui-ux-pro-max', 'design-review', 'vibe.design'],
  'swift-ios': ['ui-ux-pro-max', 'design-review', 'vibe.design'],
  'kotlin-android': ['ui-ux-pro-max', 'design-review', 'vibe.design'],
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
 * 스택 타입 배열 → 매핑 테이블에서 exact + prefix(예: 'typescript-react' → 'typescript') 매칭 값 목록.
 * resolveLocalSkills / resolveExternalSkills / resolveLocalAgentGroups 공용 헬퍼 (D5).
 */
function resolveByStack<T>(map: Record<string, ReadonlyArray<T>>, stackTypes: string[]): T[] {
  const result = new Set<T>();
  for (const stack of stackTypes) {
    // exact match (e.g., 'typescript-react')
    const exact = map[stack];
    if (exact) exact.forEach(v => result.add(v));
    // prefix match (e.g., 'typescript' from 'typescript-react')
    const prefix = stack.split('-')[0];
    if (prefix !== stack) {
      const prefixValues = map[prefix];
      if (prefixValues) prefixValues.forEach(v => result.add(v));
    }
  }
  return [...result];
}

/**
 * 스택 타입 + capabilities → 로컬 설치할 스킬 목록 결정
 */
export function resolveLocalSkills(stackTypes: string[], capabilities: string[] = []): string[] {
  const skills = new Set<string>(resolveByStack(STACK_TO_SKILLS, stackTypes));

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
  const skills = new Set<string>(resolveByStack(STACK_TO_EXTERNAL_SKILLS, stackTypes));

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
export const CONDITIONAL_AGENT_GROUPS: ReadonlyArray<string> = ['ui', 'event'];

/** 스택 → 에이전트 그룹 매핑 (vibe init/update → .claude/agents/) */
export const STACK_TO_AGENT_GROUPS: Record<string, ReadonlyArray<string>> = {
  'typescript-react': ['ui'],
  'typescript-nextjs': ['ui'],
  'typescript-vue': ['ui'],
  'typescript-nuxt': ['ui'],
  'typescript-svelte': ['ui'],
  'typescript-angular': ['ui'],
  'typescript-astro': ['ui'],
  'typescript-react-native': ['ui'],
  'dart-flutter': ['ui'],
};

/** capability → 에이전트 그룹 매핑 */
export const CAPABILITY_AGENT_GROUPS: Record<string, ReadonlyArray<string>> = {
  'event-automation': ['event'],
};

/**
 * 제거된 조건부 에이전트 그룹 — 프로젝트 로컬(.claude/agents/)에 남은 잔여 디렉토리 정리.
 * vibe init/update 시 `removeLegacySkills`(범용 디렉토리 삭제)로 정리한다.
 * (B6: figma 그룹 — 그룹 내 유일했던 에이전트 삭제로 그룹 자체 폐지)
 */
export const LEGACY_AGENT_GROUPS: ReadonlyArray<string> = [
  'figma',
];

/**
 * 스택 타입 + capabilities → 로컬 설치할 에이전트 그룹 결정
 * (resolveLocalSkills와 동일한 exact + prefix 매칭 규칙)
 */
export function resolveLocalAgentGroups(stackTypes: string[], capabilities: string[] = []): string[] {
  const groups = new Set<string>(resolveByStack(STACK_TO_AGENT_GROUPS, stackTypes));

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

// Cursor 모델 매핑 (리뷰어 → 모델)
// 사용 가능: composer-1, claude-4.5-opus-high, claude-4.5-opus-high-thinking,
//           claude-4.5-sonnet-thinking, gpt-5.5, gpt-5.5-pro, antigravity-pro, antigravity-fast
export const CURSOR_MODEL_MAPPING: Record<string, string> = {
  // 통합 리뷰어 2종 — 깊은 추론 필요 → thinking 모델
  'code-reviewer': 'claude-4.5-sonnet-thinking',
  'security-reviewer': 'claude-4.5-sonnet-thinking',
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
  // v2.17 하네스 다이어트 (harness-review-2026-07-01) — 삭제/병합된 스킬
  'interview',
  'plan',
  'spec-review',
  'techdebt',
  'systematic-debugging',
  'typescript-advanced-types',
  'rob-pike',
  'yagni-ladder',
  'claude-md-guide',
  'characterization-test',
  'design-audit',
  'design-critique',
  'design-polish',
  'design-normalize',
  'design-distill',
  'figma-extract',
  'figma-convert',
  // v3.x utils-dissolution — vibe.utils 해체 (→ vibe.continue/vibe.image/docs/vibe.design/vibe.verify)
  'vibe.utils',
];

// ─── Claude Code 네이티브 서브에이전트 매핑 ───

// Claude Code 모델 매핑 (사용 가능: sonnet, opus, haiku, inherit)
// 독트린: 기본은 세션 모델 상속 — 여기 명시된 tier 는 의도적 예외만
// (아키텍처 심층 리뷰 → opus, 기계적 문서/다이어그램 → haiku).
export const CLAUDE_MODEL_MAPPING: Record<string, string> = {
  'architect': 'opus',
  'implementer': 'sonnet',
  'tester': 'haiku',
  'e2e-tester': 'sonnet',
  'build-error-resolver': 'sonnet',
  'code-reviewer': 'sonnet',
  'security-reviewer': 'sonnet',
  // UI agents (conditional group)
  'design-reviewer': 'sonnet',
  'design-system-gen': 'sonnet',
  // Event agents (conditional group)
  'event-planner': 'sonnet',
  'event-ops': 'sonnet',
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
  'architect': 'read-only',
  'implementer': 'write-capable',
  'tester': 'write-capable',
  'e2e-tester': 'write-capable',
  'build-error-resolver': 'write-capable',
  // 리뷰어 — git 이력/감사 명령이 필요해 Bash 포함 read-only
  'code-reviewer': 'read-only-git',
  'security-reviewer': 'read-only-git',
  // UI agents
  'design-reviewer': 'read-only',
  'design-system-gen': 'write-capable',
  // Event agents
  'event-planner': 'write-capable',
  'event-ops': 'write-capable',
};

// 에이전트 → 권한 모드 매핑
export const CLAUDE_AGENT_PERMISSION_MODE: Record<string, string> = {
  // 읽기 전용 에이전트 → plan
  'architect': 'plan',
  'code-reviewer': 'plan',
  'security-reviewer': 'plan',
  'design-reviewer': 'plan',
  // 수정 가능 에이전트 → acceptEdits
  'implementer': 'acceptEdits',
  'tester': 'acceptEdits',
  'e2e-tester': 'acceptEdits',
  'build-error-resolver': 'acceptEdits',
  'design-system-gen': 'acceptEdits',
  'event-planner': 'acceptEdits',
  'event-ops': 'acceptEdits',
};

// NO FILE CREATION 에이전트 → Write, Edit 차단
export const CLAUDE_AGENT_DISALLOWED_TOOLS: Record<string, string[]> = {
  'design-reviewer': ['Write', 'Edit'],
};

// 지속 메모리 설정 (세션 간 패턴 축적)
export const CLAUDE_AGENT_MEMORY: Record<string, string> = {
  'code-reviewer': 'user',
  'security-reviewer': 'user',
};
