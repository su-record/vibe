/**
 * 상수 데이터
 */

// ─── 스킬 설치 범위 분류 ───

/**
 * 전역 설치 스킬 (postinstall → ~/.claude/skills/) — 공개 분류
 * 내부 core 동작은 관련 공개 스킬 본문에 통합하며 별도 discovery 항목으로 설치하지 않는다.
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

export const GLOBAL_SKILLS_STANDARD: ReadonlyArray<string> = [
  'vibe.parallel-research',
  'vibe.educational-content',
  'vibe.handoff',
  'vibe.priority-todos',
  'vibe.agents-md',
  'vibe.capability-loop',
  'vibe.design-teach',
];

/** 전역 설치에서 제외된 스킬 (명시적 /skill-name 호출 시에만 활성)
 *  사유: 표준 도구 래퍼이거나 구체성 부족 — 직접 프롬프트가 더 효과적 */
export const GLOBAL_SKILLS_OPTIONAL: ReadonlyArray<string> = [
  'vibe.commit-push-pr',
  'vibe.git-worktree',
  'vibe.tool-fallback',
  'vibe.context7-usage',
  'vibe.chub-usage',
  'vibe.presentation',
];

/** 전역 설치 스킬 전체 (하위 호환용) */
export const GLOBAL_SKILLS: ReadonlyArray<string> = [
  ...GLOBAL_SKILLS_ENTRY,
  ...GLOBAL_SKILLS_STANDARD,
];

/** 스택 → 로컬 스킬 매핑 (vibe init/update → .claude/skills/) */
export const STACK_TO_SKILLS: Record<string, ReadonlyArray<string>> = {
  // Web frontend → UI/UX + SEO + Design steering + React best practices
  'typescript-react': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.react-best-practices', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  'typescript-nextjs': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.react-best-practices', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  'typescript-vue': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  'typescript-nuxt': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  'typescript-svelte': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  'typescript-angular': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  'typescript-astro': ['vibe.ui-ux-pro-max', 'vibe.brand-assets', 'vibe.seo-checklist', 'vibe.design-review', 'vibe.design-refine', 'vibe.design'],
  // Mobile → UI + design-review only (refine 파이프라인은 CSS 기반)
  'typescript-react-native': ['vibe.ui-ux-pro-max', 'vibe.design-review', 'vibe.design'],
  'dart-flutter': ['vibe.ui-ux-pro-max', 'vibe.design-review', 'vibe.design'],
  'swift-ios': ['vibe.ui-ux-pro-max', 'vibe.design-review', 'vibe.design'],
  'kotlin-android': ['vibe.ui-ux-pro-max', 'vibe.design-review', 'vibe.design'],
};

/** Capability → 로컬 스킬 매핑 (의존성 감지 기반 자동 설치) */
export const CAPABILITY_SKILLS: Record<string, ReadonlyArray<string>> = {
  'commerce': ['vibe.commerce-patterns', 'vibe.e2e-commerce'],
  'video': ['vibe.video-production'],
  'event-automation': ['vibe.event-planning', 'vibe.event-comms', 'vibe.event-ops'],
  'pm': ['vibe.create-prd', 'vibe.prioritization', 'vibe.user-personas'],
  'devlog': ['vibe.devlog'],
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

/** v3.2 namespace 통합 — 설치된 bare 스킬을 배송본과 일치할 때만 제거한다. */
export const LEGACY_SKILL_RENAMES: Readonly<Record<string, string>> = {
  'spec': 'vibe.spec',
  'test': 'vibe.test',
  'contract': 'vibe.contract',
  'regress': 'vibe.regress',
  'figma': 'vibe.figma',
  'clone': 'vibe.clone',
  'docs': 'vibe.docs',
  'arch-guard': 'vibe.run',
  'exec-plan': 'vibe.run',
  'restraint': 'vibe.run',
  'agents-md': 'vibe.agents-md',
  'brand-assets': 'vibe.brand-assets',
  'capability-loop': 'vibe.capability-loop',
  'chub-usage': 'vibe.chub-usage',
  'commerce-patterns': 'vibe.commerce-patterns',
  'commit-push-pr': 'vibe.commit-push-pr',
  'context7-usage': 'vibe.context7-usage',
  'create-educational-content': 'vibe.educational-content',
  'create-prd': 'vibe.create-prd',
  'design-refine': 'vibe.design-refine',
  'design-review': 'vibe.design-review',
  'design-teach': 'vibe.design-teach',
  'devlog': 'vibe.devlog',
  'e2e-commerce': 'vibe.e2e-commerce',
  'event-comms': 'vibe.event-comms',
  'event-ops': 'vibe.event-ops',
  'event-planning': 'vibe.event-planning',
  'git-worktree': 'vibe.git-worktree',
  'handoff': 'vibe.handoff',
  'parallel-research': 'vibe.parallel-research',
  'presentation': 'vibe.presentation',
  'prioritization-frameworks': 'vibe.prioritization',
  'priority-todos': 'vibe.priority-todos',
  'seo-checklist': 'vibe.seo-checklist',
  'tool-fallback': 'vibe.tool-fallback',
  'ui-ux-pro-max': 'vibe.ui-ux-pro-max',
  'user-personas': 'vibe.user-personas',
  'vercel-react-best-practices': 'vibe.react-best-practices',
  'video-production': 'vibe.video-production',
};

/** v3.2에서 배송했던 bare SKILL.md의 SHA-256. 정확히 일치하는 설치본만 정리한다. */
export const LEGACY_SKILL_HASHES: Readonly<Record<string, string>> = {
  'spec': 'bb4669226994567ae65606baf5b03f18a8f7474d98147e325461f696e868a90b',
  'test': 'f92283dccedfd2cc0907711edb2b7a36c8804d8fe1d0d29233a74d16ff5127',
  'contract': '0e29f293748b6b0be66587cabef59db316495278eb33fa1bff6b97c77bc4b798',
  'regress': '3217c64a8f144c6d06bd24a17ccbe47bb8d3a1d9f80cc6ca3459e9f801a34589',
  'figma': 'e4c7a5b3dc6a918799f8dc4f3496e67b008613d6e2cb0ccc22dd5190e494ad7c',
  'clone': '37a4ee0830fae51521c2b0be9884a67db8a3b682a53ed6d062e15179363da1af',
  'docs': 'f18fa3ad586354c314b08925f15ca3d9630f33be6619fb4f87659ab2c19e54bb',
  'arch-guard': '2bfd781664a625f5afdfadbb5697b73a3062fa21c5d43057a5796eda79d70642',
  'exec-plan': '5394fcfd8fb0c7ce9923168a6b78d56c880159c10feb5667efa696f36a2ca12d',
  'restraint': '6ac370ddd11a4cb56f51297bb582644402e15f77214fb32669510f156d6f9296',
  'agents-md': 'f1a4ddf97755a02608058bf8c8668afe6953b47d628409bfa1ffc572a11c543a',
  'brand-assets': 'af30b27f472706ebc372d8f9916c1816ae8bc50e157e6659cb2197a94f84d7b8',
  'capability-loop': 'fb624b8d9f4c09b2e7d2bb7be0d77ff2eb06151a1ffb1ac720d103f8a4af38ce',
  'chub-usage': '89d282979cac295bb3a7f9c9cce7d38ae769776e133f47d06695ccf6c5882487',
  'commerce-patterns': 'ca5ce5d85e6bbae7f1147b3601a9afd4b7fc8ef4e97b5fb6eb5cf4e387a8a448',
  'commit-push-pr': '232274ec0320a6408267013b44922756804180483dd2fca87411a9f1d44164fb',
  'context7-usage': '82efa24624d3955b6cbdac3ccd46d1b9b1b7e36f7b7273717d77fd57b68fd053',
  'create-prd': '407a9063929171805f34fec9caf0a42b9ae2a0902f74d8c6c6fbac6aa7592e19',
  'design-refine': '67ef3f2be393b4c00c2a2a50264787207cd7ba77ad246b1bf763b17eea1a75a1',
  'design-review': 'd5fb61d315b8fd81c7aa069c1802490ad7976859fcc7f99dfd53c290fedaca04',
  'design-teach': 'af230a0fea9d1b2f9a057ab8733162fe9309c72f435e4d6ca6ede0d5725cc44f',
  'devlog': '2a4c76e664247ae430a2780f3e875a2a201439996a755ea4a8c0cb523509c6a3',
  'e2e-commerce': '27f7c2d2341d48eaa5288c2cc4a052632d3578bd49065ed1493c84f026c9db97',
  'event-comms': 'ce0069bb41c68074944b8127a7e6164dd7247804ff2aceb3bf72995d30ae5af6',
  'event-ops': '8d736102135e7e2aeda6fd5c6e73d4ab87bccbf65c3beb82016faca190b108d3',
  'event-planning': '7c60fabe6d5b93709634fb2a1036159de8bb7a9c23e139e6d6b542f49ad12ba6',
  'git-worktree': '9f85907052c305a32f4ab2c1632a7aa4f30b1e86733de739198d96e33077fdb0',
  'handoff': '42b723f5d53e00c093f8f68347afd4242d026258df3f5d6e9831efeef5fde217',
  'parallel-research': '8d7562ebaf4fe642122f88165a7bbea4c3280a954599dcf7c4d827c465ed0ffb',
  'presentation': '38f6a09bbb1c6739f5cf93d74f9136a0537a42271bc4bcdf974203ebf34d6b09',
  'prioritization-frameworks': 'fe7a09c3493e5c5badd4d82a079088a33bfaed9fea63c17bef30bdeba20ccf38',
  'priority-todos': '482e9f19cf15e4b052b5c4abdfed1bf976940cd2a4acbe1ba74fc41d4f034a56',
  'seo-checklist': '3b87d583df9243b98ac5fbe84d4427a7fc9b161219c746142940c15811a0ea1e',
  'tool-fallback': 'd135cb53ace2db8eeaf359a57fd77c687397e6bc6e94b1773eae4ab2d9ae1d57',
  'ui-ux-pro-max': '58234b04bf3c4080331423641de65b7e965e7f8098bb35af394a2bfa43bac21f',
  'user-personas': 'cefea1faf1b8ad53a7e97c47f7c4c249e5b2ee58b8f14f00a90edcfc35e901b4',
  'vercel-react-best-practices': 'c880fd8288ffeb029f99cd7cc65dbd129009873e7eef62f396f30817404525f8',
  'video-production': 'f25449e655b207216557ef2b1787d268fe659e6a1a45c9f717c35a170991af5b',
};

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
