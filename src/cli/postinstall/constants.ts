/**
 * 상수 데이터
 */

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
//           claude-4.5-sonnet-thinking, gpt-5.2-codex, gpt-5.2, gpt-5.2-high,
//           gemini-3-pro, gemini-3-flash
export const CURSOR_MODEL_MAPPING: Record<string, string> = {
  // 보안/아키텍처: 깊은 추론 필요 → thinking 모델
  'security-reviewer': 'claude-4.5-sonnet-thinking',
  'architecture-reviewer': 'claude-4.5-sonnet-thinking',
  'data-integrity-reviewer': 'claude-4.5-sonnet-thinking',

  // 언어별 전문가: 코드 이해 필요 → codex
  'typescript-reviewer': 'gpt-5.2-codex',
  'python-reviewer': 'gpt-5.2-codex',
  'react-reviewer': 'gpt-5.2-codex',
  'rails-reviewer': 'gpt-5.2-codex',

  // 빠른 패턴 체크: 경량 모델
  'performance-reviewer': 'gemini-3-flash',
  'complexity-reviewer': 'gemini-3-flash',
  'simplicity-reviewer': 'gemini-3-flash',
  'test-coverage-reviewer': 'gemini-3-flash',
  'git-history-reviewer': 'gemini-3-flash',
};

// 언어 룰 파일 접두사 (이 접두사로 시작하는 .mdc는 core에서 관리)
export const LANGUAGE_RULE_PREFIXES = [
  'typescript-', 'python-', 'dart-', 'go.', 'rust.', 'kotlin-',
  'java-', 'swift-', 'ruby-', 'csharp-', 'gdscript-'
];

// 이전 버전에서 생성된 레거시 파일명 (정리 대상)
export const LEGACY_RULE_FILES = [
  'react-patterns.mdc', 'typescript-standards.mdc', 'python-standards.mdc'
];
