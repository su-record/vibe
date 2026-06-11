/**
 * 기술 스택 감지
 */

import path from 'path';
import fs from 'fs';
import { DetectedStack, StackDetails, DetectionResult } from './types.js';
import { detectInDir, detectHosting, detectCicd } from './detect/matcher.js';
import { detectWorkspacePaths } from './detect/workspace.js';

// ── conventional sub-directory names ──────────────────────────────────────

const CONVENTIONAL_SUBDIRS = ['backend', 'frontend', 'server', 'client', 'api', 'web', 'mobile', 'app'];
const MONOREPO_FALLBACK_DIRS = ['packages', 'apps', 'libs'];

// ── helpers ────────────────────────────────────────────────────────────────

function dedupeDetails(details: StackDetails): void {
  details.databases = [...new Set(details.databases)];
  details.stateManagement = [...new Set(details.stateManagement)];
  details.hosting = [...new Set(details.hosting)];
  details.cicd = [...new Set(details.cicd)];
  details.capabilities = [...new Set(details.capabilities)];
}

function scanDir(
  dir: string,
  prefix: string,
  details: StackDetails,
  stacks: DetectedStack[],
): void {
  stacks.push(...detectInDir(dir, prefix, details));
}

function scanConventionalSubdirs(
  projectRoot: string,
  details: StackDetails,
  stacks: DetectedStack[],
): void {
  for (const sub of CONVENTIONAL_SUBDIRS) {
    const full = path.join(projectRoot, sub);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      scanDir(full, sub, details, stacks);
    }
  }
}

function scanWorkspacePaths(
  projectRoot: string,
  workspacePaths: string[],
  scanned: Set<string>,
  details: StackDetails,
  stacks: DetectedStack[],
): void {
  for (const ws of workspacePaths) {
    if (scanned.has(ws)) continue;
    scanned.add(ws);
    const full = path.join(projectRoot, ws);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      scanDir(full, ws, details, stacks);
    }
  }
}

function scanMonorepoFallback(
  projectRoot: string,
  scanned: Set<string>,
  details: StackDetails,
  stacks: DetectedStack[],
): void {
  for (const monoDir of MONOREPO_FALLBACK_DIRS) {
    const monoPath = path.join(projectRoot, monoDir);
    if (!fs.existsSync(monoPath) || !fs.statSync(monoPath).isDirectory()) continue;
    try {
      const entries = fs.readdirSync(monoPath).filter(f => {
        const fp = path.join(monoPath, f);
        return fs.statSync(fp).isDirectory() && !f.startsWith('.');
      });
      for (const entry of entries) {
        const rel = `${monoDir}/${entry}`;
        if (scanned.has(rel)) continue;
        scanned.add(rel);
        scanDir(path.join(monoPath, entry), rel, details, stacks);
      }
    } catch { /* ignore */ }
  }
}

// ── public API ─────────────────────────────────────────────────────────────

/**
 * 프로젝트 기술 스택 감지
 */
export function detectTechStacks(projectRoot: string): DetectionResult {
  const stacks: DetectedStack[] = [];
  const details: StackDetails = {
    databases: [], stateManagement: [], hosting: [], cicd: [], capabilities: [],
  };

  // Root
  scanDir(projectRoot, '', details, stacks);

  // Conventional sub-directories (backend/, frontend/, …)
  scanConventionalSubdirs(projectRoot, details, stacks);

  // Monorepo workspace paths
  const workspacePaths = detectWorkspacePaths(projectRoot);
  const scanned = new Set<string>();
  scanWorkspacePaths(projectRoot, workspacePaths, scanned, details, stacks);

  // Fallback: scan packages/, apps/, libs/ if no workspace config found
  if (workspacePaths.length === 0) {
    scanMonorepoFallback(projectRoot, scanned, details, stacks);
  }

  // Project-root-level details (hosting, CI/CD)
  details.hosting.push(...detectHosting(projectRoot));
  details.cicd.push(...detectCicd(projectRoot));

  dedupeDetails(details);

  return { stacks, details };
}

/**
 * 스택 타입에 대한 이름 매핑
 */
export const STACK_NAMES: Record<string, { name: string; lang: string; framework: string }> = {
  // Desktop/Mobile
  'typescript-tauri':         { name: 'Tauri',        lang: 'TypeScript',    framework: 'Tauri' },
  'typescript-electron':      { name: 'Electron',     lang: 'TypeScript',    framework: 'Electron' },
  'typescript-react-native':  { name: 'React Native', lang: 'TypeScript',    framework: 'React Native' },
  // Fullstack/SSR
  'typescript-nextjs':        { name: 'Next.js',      lang: 'TypeScript',    framework: 'Next.js' },
  'typescript-nuxt':          { name: 'Nuxt',         lang: 'TypeScript',    framework: 'Nuxt' },
  'typescript-astro':         { name: 'Astro',        lang: 'TypeScript',    framework: 'Astro' },
  // Frontend
  'typescript-angular':       { name: 'Angular',      lang: 'TypeScript',    framework: 'Angular' },
  'typescript-svelte':        { name: 'Svelte',       lang: 'TypeScript',    framework: 'Svelte/SvelteKit' },
  'typescript-vue':           { name: 'Vue',          lang: 'TypeScript',    framework: 'Vue' },
  'typescript-react':         { name: 'React',        lang: 'TypeScript',    framework: 'React' },
  // Backend
  'typescript-nestjs':        { name: 'NestJS',       lang: 'TypeScript',    framework: 'NestJS' },
  'typescript-node':          { name: 'Node.js',      lang: 'TypeScript',    framework: 'Node.js' },
  // Python
  'python-fastapi':           { name: 'FastAPI',      lang: 'Python 3.11+',  framework: 'FastAPI' },
  'python-django':            { name: 'Django',       lang: 'Python 3.11+',  framework: 'Django' },
  'python':                   { name: 'Python',       lang: 'Python 3.11+',  framework: 'Python' },
  // Other languages
  'dart-flutter':             { name: 'Flutter',      lang: 'Dart',          framework: 'Flutter' },
  'go':                       { name: 'Go',           lang: 'Go 1.21+',      framework: 'Go' },
  'rust':                     { name: 'Rust',         lang: 'Rust',          framework: 'Rust' },
  'kotlin-android':           { name: 'Android',      lang: 'Kotlin',        framework: 'Android' },
  'kotlin':                   { name: 'Kotlin',       lang: 'Kotlin',        framework: 'Kotlin' },
  'java-spring':              { name: 'Spring',       lang: 'Java 17+',      framework: 'Spring Boot' },
  'java':                     { name: 'Java',         lang: 'Java 17+',      framework: 'Java' },
  'swift-ios':                { name: 'iOS',          lang: 'Swift',         framework: 'SwiftUI/UIKit' },
  'ruby-rails':               { name: 'Rails',        lang: 'Ruby',          framework: 'Ruby on Rails' },
  'csharp-unity':             { name: 'Unity',        lang: 'C#',            framework: 'Unity' },
  'gdscript-godot':           { name: 'Godot',        lang: 'GDScript',      framework: 'Godot Engine' },
};

/**
 * 스택에 맞는 언어 규칙 파일 목록 반환
 */
export function getLanguageRulesForStacks(stacks: Array<{ type: string; path: string }>): string {
  const ruleFiles: string[] = [];
  for (const stack of stacks) {
    if (STACK_NAMES[stack.type]) ruleFiles.push(`${stack.type}.md`);
  }
  return [...new Set(ruleFiles)].join(', ');
}

/**
 * 언어별 CLAUDE.md 규칙
 */
export const LANGUAGE_RULES: Record<string, string> = {
  typescript: `### TypeScript Rules
- No \`any\` type → use \`unknown\` + type guards
- No \`as any\` casting → define proper interfaces
- No \`@ts-ignore\` → fix type issues at root
- Explicit return types on all functions`,
  python: `### Python Rules
- Type hints required (parameters, return values)
- No \`# type: ignore\` → fix type issues at root
- Prefer f-strings (over format())
- Use list comprehensions appropriately`,
  go: `### Go Rules
- Handle errors immediately (if err != nil)
- Explicit error wrapping (fmt.Errorf with %w)
- Define interfaces at point of use
- Prevent goroutine leaks (use context)`,
  rust: `### Rust Rules
- No unwrap()/expect() in production → handle Result/Option
- Minimize unsafe blocks
- Define explicit error types
- Document ownership/lifetime clearly`,
  java: `### Java Rules
- Use Optional (instead of null)
- Prefer immutable objects (final fields)
- Handle checked exceptions properly
- Utilize Stream API`,
  kotlin: `### Kotlin Rules
- Explicit nullable types (?)
- No !! operator → use safe call (?.)
- Use data classes actively
- Implement utilities as extension functions`,
  dart: `### Dart Rules
- Follow null safety (use ? and ! properly)
- Avoid late keyword abuse
- Use const constructors
- Use async/await for async code`,
  swift: `### Swift Rules
- No force unwrapping → use guard let / if let
- Prefer protocol-oriented programming
- Prefer value types (struct)
- Watch memory management with @escaping closures`,
};

/**
 * 스택에 맞는 언어 규칙 내용 반환
 */
export function getLanguageRulesContent(stacks: Array<{ type: string; path: string }>): string {
  const addedRules = new Set<string>();
  const rules: string[] = [];

  for (const stack of stacks) {
    let langKey = '';
    if (stack.type.startsWith('typescript')) langKey = 'typescript';
    else if (stack.type.startsWith('python')) langKey = 'python';
    else if (stack.type === 'go') langKey = 'go';
    else if (stack.type === 'rust') langKey = 'rust';
    else if (stack.type.startsWith('java')) langKey = 'java';
    else if (stack.type.startsWith('kotlin')) langKey = 'kotlin';
    else if (stack.type.startsWith('dart')) langKey = 'dart';
    else if (stack.type.startsWith('swift')) langKey = 'swift';

    if (langKey && !addedRules.has(langKey) && LANGUAGE_RULES[langKey]) {
      addedRules.add(langKey);
      rules.push(LANGUAGE_RULES[langKey]);
    }
  }

  return rules.join('\n\n');
}
