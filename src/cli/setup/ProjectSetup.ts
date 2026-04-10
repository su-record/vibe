/**
 * ProjectSetup - 프로젝트 레벨 설정
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { VibeConfig, VibeReferences, TechStack, StackDetails } from '../types.js';
import { ensureDir, removeDirRecursive, log } from '../utils.js';
import { STACK_NAMES, getLanguageRulesContent } from '../detect.js';
import { STACK_TO_LANGUAGE_FILE } from '../postinstall.js';
import { detectOsLanguage } from './LanguageDetector.js';
import { getCoreConfigDir } from './GlobalInstaller.js';
import { handleCaughtError } from '../../infra/lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * constitution.md 생성 또는 업데이트
 */
export function updateConstitution(
  coreDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails
): void {
  const templatePath = path.join(__dirname, '../../../vibe/templates/constitution-template.md');
  const constitutionPath = path.join(coreDir, 'constitution.md');

  if (!fs.existsSync(templatePath)) return;

  let constitution = fs.readFileSync(templatePath, 'utf-8');

  const backendStack = detectedStacks.find(s =>
    s.type.includes('python') || s.type.includes('node') ||
    s.type.includes('go') || s.type.includes('java') || s.type.includes('rust')
  );
  const frontendStack = detectedStacks.find(s =>
    s.type.includes('react') || s.type.includes('vue') ||
    s.type.includes('flutter') || s.type.includes('swift') || s.type.includes('android')
  );

  if (backendStack && STACK_NAMES[backendStack.type]) {
    const info = STACK_NAMES[backendStack.type];
    constitution = constitution.replace('- Language: {Python 3.11+ / Node.js / etc.}', `- Language: ${info.lang}`);
    constitution = constitution.replace('- Framework: {FastAPI / Express / etc.}', `- Framework: ${info.framework}`);
  }

  if (frontendStack && STACK_NAMES[frontendStack.type]) {
    const info = STACK_NAMES[frontendStack.type];
    constitution = constitution.replace('- Framework: {Flutter / React / etc.}', `- Framework: ${info.framework}`);
  }

  constitution = constitution.replace(
    '- Database: {PostgreSQL / MongoDB / etc.}',
    stackDetails.databases.length > 0 ? `- Database: ${stackDetails.databases.join(', ')}` : '- Database: (configure for your project)'
  );
  constitution = constitution.replace(
    '- State Management: {Provider / Redux / etc.}',
    stackDetails.stateManagement.length > 0 ? `- State Management: ${stackDetails.stateManagement.join(', ')}` : '- State Management: (configure for your project)'
  );
  constitution = constitution.replace(
    '- Hosting: {Cloud Run / Vercel / etc.}',
    stackDetails.hosting.length > 0 ? `- Hosting: ${stackDetails.hosting.join(', ')}` : '- Hosting: (configure for your project)'
  );
  constitution = constitution.replace(
    '- CI/CD: {GitHub Actions / etc.}',
    stackDetails.cicd.length > 0 ? `- CI/CD: ${stackDetails.cicd.join(', ')}` : '- CI/CD: (configure for your project)'
  );

  fs.writeFileSync(constitutionPath, constitution);
}

/**
 * CLAUDE.md 업데이트 (core 섹션 추가/교체)
 */

/**
 * 프로젝트 분석 → CLAUDE.md 생성/갱신
 * 정적 템플릿이 아닌, 실제 프로젝트 구조를 분석해서 맞춤 생성
 */
export function generateProjectClaudeMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
): void {
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');

  // 프로젝트 구조 분석
  const dirs = analyzeProjectStructure(projectRoot);
  const stackNames = detectedStacks.map(s => STACK_NAMES[s.type]?.name || s.type);
  const language = detectOsLanguage();

  // VIBE 섹션 생성
  const vibeSection = buildVibeSection(projectRoot, dirs, stackNames, stackDetails, language);

  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');
    const startIdx = existing.indexOf('# VIBE');
    const endIdx = existing.indexOf('<!-- VIBE:END -->');

    if (startIdx !== -1 && endIdx !== -1) {
      // 마커 기반 교체
      const before = existing.substring(0, startIdx).trimEnd();
      const after = existing.substring(endIdx + '<!-- VIBE:END -->'.length).trimStart();
      const newContent = (before ? before + '\n\n' : '') + vibeSection + (after ? '\n\n' + after : '');
      fs.writeFileSync(claudeMdPath, newContent);
    } else if (startIdx !== -1) {
      // # VIBE는 있지만 END 마커 없음 — 이후 전체 교체
      const before = existing.substring(0, startIdx).trimEnd();
      fs.writeFileSync(claudeMdPath, (before ? before + '\n\n' : '') + vibeSection);
    } else {
      // VIBE 섹션 없음 — 추가
      fs.writeFileSync(claudeMdPath, existing.trimEnd() + '\n\n' + vibeSection);
    }
  } else {
    fs.writeFileSync(claudeMdPath, vibeSection);
  }
}

/**
 * 프로젝트 분석 → AGENTS.md 생성/갱신 (Codex CLI용)
 */
export function generateProjectAgentsMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
): void {
  const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
  const dirs = analyzeProjectStructure(projectRoot);
  const stackNames = detectedStacks.map(s => STACK_NAMES[s.type]?.name || s.type);
  const language = detectOsLanguage();

  let vibeSection = buildVibeSection(projectRoot, dirs, stackNames, stackDetails, language);
  // Codex 적응: Claude Code → Codex CLI, .claude/ → .codex/
  vibeSection = vibeSection.replace(/Claude Code/g, 'Codex CLI');
  vibeSection = vibeSection.replace(/~\/\.claude\//g, '~/.codex/');
  vibeSection = vibeSection.replace(/\.claude\//g, '.codex/');

  const wrapped = `${VIBE_START}\n${vibeSection}\n${VIBE_END_TAG}`;

  if (fs.existsSync(agentsMdPath)) {
    const existing = fs.readFileSync(agentsMdPath, 'utf-8');
    const startIdx = existing.indexOf(VIBE_START);
    const endIdx = existing.indexOf(VIBE_END_TAG);

    if (startIdx !== -1 && endIdx !== -1) {
      const before = existing.substring(0, startIdx).trimEnd();
      const after = existing.substring(endIdx + VIBE_END_TAG.length).trimStart();
      fs.writeFileSync(agentsMdPath, (before ? before + '\n\n' : '') + wrapped + (after ? '\n\n' + after : ''));
    } else if (!existing.includes('/vibe.spec')) {
      fs.writeFileSync(agentsMdPath, existing.trimEnd() + '\n\n' + wrapped + '\n');
    }
  } else {
    fs.writeFileSync(agentsMdPath, wrapped + '\n');
  }
}

/** 프로젝트 디렉토리 구조 분석 */
interface ProjectDirs {
  hasSrc: boolean;
  hasDocs: boolean;
  hasDev: boolean;
  hasTests: boolean;
  hasOut: boolean;
  topLevel: string[];
  srcChildren: string[];
  buildCommand: string;
  testCommand: string;
  packageManager: string;
}

function analyzeProjectStructure(projectRoot: string): ProjectDirs {
  const topLevel = fs.readdirSync(projectRoot)
    .filter(f => !f.startsWith('.') || f === '.dev' || f === '.claude')
    .filter(f => {
      try { return fs.statSync(path.join(projectRoot, f)).isDirectory(); }
      catch { return false; }
    });

  const srcDir = path.join(projectRoot, 'src');
  const libDir = path.join(projectRoot, 'lib');
  const appDir = path.join(projectRoot, 'app');
  const mainSrc = fs.existsSync(srcDir) ? srcDir : fs.existsSync(libDir) ? libDir : fs.existsSync(appDir) ? appDir : null;

  let srcChildren: string[] = [];
  if (mainSrc) {
    srcChildren = fs.readdirSync(mainSrc)
      .filter(f => {
        try { return fs.statSync(path.join(mainSrc, f)).isDirectory(); }
        catch { return false; }
      })
      .slice(0, 15);
  }

  // 빌드/테스트 커맨드 감지
  let buildCommand = '';
  let testCommand = '';
  let packageManager = 'npm';
  const pkgPath = path.join(projectRoot, 'package.json');
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      buildCommand = pkg.scripts?.build ? `${packageManager} run build` : '';
      testCommand = pkg.scripts?.test ? `${packageManager} test` : '';
      if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
      else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) packageManager = 'yarn';
      else if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) packageManager = 'bun';
    } catch { /* ignore */ }
  } else if (fs.existsSync(pyprojectPath)) {
    buildCommand = 'python -m build';
    testCommand = 'pytest';
    packageManager = 'pip';
  }

  return {
    hasSrc: mainSrc !== null,
    hasDocs: fs.existsSync(path.join(projectRoot, 'docs')),
    hasDev: fs.existsSync(path.join(projectRoot, '.dev')),
    hasTests: fs.existsSync(path.join(projectRoot, 'tests')) || fs.existsSync(path.join(projectRoot, '__tests__')),
    hasOut: fs.existsSync(path.join(projectRoot, 'dist')) || fs.existsSync(path.join(projectRoot, 'out')) || fs.existsSync(path.join(projectRoot, 'build')),
    topLevel,
    srcChildren,
    buildCommand,
    testCommand,
    packageManager,
  };
}

/** 분석 결과 기반 VIBE 섹션 조립 */
function buildVibeSection(
  projectRoot: string,
  dirs: ProjectDirs,
  stackNames: string[],
  stackDetails: StackDetails,
  language: string,
): string {
  const lines: string[] = [];

  lines.push('# VIBE');
  lines.push('');
  if (language === 'ko') {
    lines.push('**IMPORTANT: Always respond in Korean (한국어) unless the user explicitly requests otherwise.**');
    lines.push('');
  }

  // Constraints
  lines.push('## Constraints');
  lines.push('');
  lines.push('- Modify only requested scope');
  lines.push('- Preserve existing style');
  lines.push('- Edit existing files, never create new ones');
  lines.push('- Function ≤50 lines, nesting ≤3, params ≤5, complexity ≤10');
  lines.push('- No `any`, no `console.log` in commits, no commented-out code');
  lines.push('');

  // Tech Stack
  if (stackNames.length > 0) {
    lines.push('## Tech Stack');
    lines.push('');
    lines.push(stackNames.join(', '));
    if (stackDetails.databases.length > 0) {
      lines.push(`DB: ${stackDetails.databases.join(', ')}`);
    }
    if (stackDetails.stateManagement.length > 0) {
      lines.push(`State: ${stackDetails.stateManagement.join(', ')}`);
    }
    lines.push('');
  }

  // Project Structure (실제 분석 결과)
  lines.push('## Project Structure');
  lines.push('');
  const structureRows: string[] = [];
  for (const dir of dirs.topLevel) {
    switch (dir) {
      case 'src': case 'lib': case 'app':
        structureRows.push(`| \`${dir}/\` | Business logic |`);
        break;
      case 'docs':
        structureRows.push('| `docs/` | Human-maintained business docs — **read before work** |');
        break;
      case '.dev':
        structureRows.push('| `.dev/` | AI work logs, learnings, scratch |');
        break;
      case 'tests': case '__tests__': case 'test':
        structureRows.push(`| \`${dir}/\` | Test infrastructure |`);
        break;
      case '.claude':
        structureRows.push('| `.claude/` | AI configuration, rules, skills |');
        break;
      case 'dist': case 'out': case 'build':
        structureRows.push(`| \`${dir}/\` | Build output |`);
        break;
      default:
        structureRows.push(`| \`${dir}/\` | |`);
    }
  }
  if (structureRows.length > 0) {
    lines.push('| Folder | Purpose |');
    lines.push('|--------|---------|');
    lines.push(...structureRows);
    lines.push('');
  }

  // src/ 하위 구조
  if (dirs.srcChildren.length > 0) {
    lines.push(`### Source layout: ${dirs.srcChildren.map(d => `${d}/`).join(', ')}`);
    lines.push('');
  }

  // Build & Test
  if (dirs.buildCommand || dirs.testCommand) {
    lines.push('## Commands');
    lines.push('');
    if (dirs.buildCommand) lines.push(`- Build: \`${dirs.buildCommand}\``);
    if (dirs.testCommand) lines.push(`- Test: \`${dirs.testCommand}\``);
    lines.push('');
  }

  // References (포인터)
  lines.push('## References');
  lines.push('');
  lines.push('- Rules: `.claude/vibe/config.json` → `references.rules[]`');
  lines.push('- Languages: `.claude/vibe/languages/`');
  lines.push('- Constitution: `.claude/vibe/constitution.md`');
  if (dirs.hasDocs) lines.push('- Business docs: `docs/`');
  lines.push('');

  // Workflow (간결하게)
  lines.push('## Workflow');
  lines.push('');
  lines.push('| Task | Command |');
  lines.push('|------|---------|');
  lines.push('| 1-2 files | Plan Mode |');
  lines.push('| 3+ files | `/vibe.spec` |');
  lines.push('| Analyze | `/vibe.analyze` (code, docs, web, Figma) |');
  lines.push('| Harness check | `/vibe.harness` |');
  lines.push('| Project structure | `/vibe.scaffold` |');
  lines.push('');

  // Magic Keywords
  lines.push('## Keywords');
  lines.push('');
  lines.push('`ultrawork` parallel+auto | `ralph` loop until 100% | `quick` fast mode');
  lines.push('');

  // Quality + Context
  lines.push('## Quality');
  lines.push('');
  lines.push('Convergence: loop until P1=0. Changed files only.');
  lines.push('At 70%+ context: save_memory → /new → /vibe.utils --continue');
  lines.push('');

  // Git
  lines.push('## Git');
  lines.push('');
  lines.push('Include: `.claude/vibe/{plans,specs,features,todos}/`, `CLAUDE.md`');
  lines.push('Exclude: `~/.claude/{rules,commands,agents,skills}/`, `.claude/settings.local.json`');
  lines.push('');
  lines.push('<!-- VIBE:END -->');

  return lines.join('\n');
}

/**
 * 프로젝트 core 폴더 설정
 */
export function updateRules(coreDir: string, detectedStacks: TechStack[], isUpdate = false): void {
  // 레거시 폴더 정리 (이전 버전에서 복사된 것들)
  const legacyFolders = ['rules', 'languages', 'templates'];
  legacyFolders.forEach(folder => {
    const legacyPath = path.join(coreDir, folder);
    if (fs.existsSync(legacyPath)) {
      removeDirRecursive(legacyPath);
    }
  });

  // specs, features 폴더 확인/생성
  ['specs', 'features'].forEach(dir => {
    ensureDir(path.join(coreDir, dir));
  });
}

/**
 * 프로젝트 레벨 훅 설치 (.claude/settings.local.json)
 */
export function installProjectHooks(projectRoot: string): void {
  const claudeDir = path.join(projectRoot, '.claude');
  const settingsLocalPath = path.join(claudeDir, 'settings.local.json');
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const hooksTemplate = path.join(packageRoot, 'hooks', 'hooks.json');

  if (!fs.existsSync(hooksTemplate)) return;

  ensureDir(claudeDir);

  // 템플릿 읽고 플레이스홀더 치환
  let hooksContent = fs.readFileSync(hooksTemplate, 'utf-8');
  const coreConfigPath = getCoreConfigDir();

  // Windows 경로는 슬래시 사용
  const corePathForUrl = coreConfigPath.replace(/\\/g, '/');
  hooksContent = hooksContent.replace(/\{\{VIBE_PATH\}\}/g, corePathForUrl);

  const coreHooks = JSON.parse(hooksContent);

  if (fs.existsSync(settingsLocalPath)) {
    // 기존 settings.local.json에 hooks 병합
    try {
      const existingSettings = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf-8'));
      existingSettings.hooks = coreHooks.hooks;
      fs.writeFileSync(settingsLocalPath, JSON.stringify(existingSettings, null, 2));
    } catch (e: unknown) {
      handleCaughtError('recoverable', 'Parsing existing settings.local.json failed, recreating', e, log);
      fs.writeFileSync(settingsLocalPath, JSON.stringify(coreHooks, null, 2));
    }
  } else {
    // 새로 생성
    fs.writeFileSync(settingsLocalPath, JSON.stringify(coreHooks, null, 2));
  }
}

/**
 * .gitignore 업데이트
 */
export function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) return;

  let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  let modified = false;

  // settings.local.json 추가
  if (!gitignore.includes('.claude/settings.local.json')) {
    gitignore = gitignore.trimEnd() + '\n\n# core project hooks (personal)\n.claude/settings.local.json\n';
    modified = true;
  }

  // .gemini/settings.json 추가 (Gemini CLI hooks - 개인 설정)
  if (!gitignore.includes('.gemini/settings.json')) {
    gitignore = gitignore.trimEnd() + '\n\n# Gemini CLI hooks (personal)\n.gemini/settings.json\n';
    modified = true;
  }

  // checkpoints 디렉토리 제외 (Phase Isolation Protocol 임시 파일)
  if (!gitignore.includes('.claude/vibe/checkpoints/')) {
    gitignore = gitignore.trimEnd() + '\n\n# Phase checkpoints (ephemeral)\n.claude/vibe/checkpoints/\n';
    modified = true;
  }

  // 레거시 mcp 폴더 제외 제거
  if (gitignore.includes('.claude/vibe/mcp/')) {
    gitignore = gitignore.replace(/# core MCP\n\.claude\/vibe\/mcp\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/mcp\/\n?/g, '');
    modified = true;
  }

  // .dev/scratch/ (AI experiment files, not committed)
  if (!gitignore.includes('.dev/scratch/')) {
    gitignore = gitignore.trimEnd() + '\n\n# AI scratch files (ephemeral)\n.dev/scratch/\n';
    modified = true;
  }

  // 레거시 node_modules 제외 제거
  if (gitignore.includes('.claude/vibe/node_modules/')) {
    gitignore = gitignore.replace(/# core local packages\n\.claude\/vibe\/node_modules\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/node_modules\/\n?/g, '');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(gitignorePath, gitignore);
  }
}

/**
 * 스택 기반 references 생성
 */
function generateReferences(detectedStacks: TechStack[]): VibeReferences {
  const globalCoreDir = '~/.claude/vibe';

  const rules = [
    `${globalCoreDir}/rules/principles/quick-start.md`,
    `${globalCoreDir}/rules/principles/development-philosophy.md`,
    `${globalCoreDir}/rules/principles/communication-guide.md`,
    `${globalCoreDir}/rules/quality/checklist.md`,
    `${globalCoreDir}/rules/quality/bdd-contract-testing.md`,
    `${globalCoreDir}/rules/quality/testing-strategy.md`,
    `${globalCoreDir}/rules/standards/anti-patterns.md`,
    `${globalCoreDir}/rules/standards/code-structure.md`,
    `${globalCoreDir}/rules/standards/complexity-metrics.md`,
    `${globalCoreDir}/rules/standards/naming-conventions.md`
  ];

  const languages = detectedStacks.map(stack =>
    `${globalCoreDir}/languages/${stack.type}.md`
  );

  const templates = [
    `${globalCoreDir}/templates/plan-template.md`,
    `${globalCoreDir}/templates/spec-template.md`,
    `${globalCoreDir}/templates/feature-template.md`,
    `${globalCoreDir}/templates/constitution-template.md`,
    `${globalCoreDir}/templates/contract-backend-template.md`,
    `${globalCoreDir}/templates/contract-frontend-template.md`
  ];

  return { rules, languages, templates };
}

/**
 * config.json 생성/업데이트
 */
export function updateConfig(
  coreDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  isUpdate = false
): void {
  const configPath = path.join(coreDir, 'config.json');
  const references = generateReferences(detectedStacks);

  if (isUpdate && fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (!config.language) {
        config.language = detectOsLanguage();
      }
      if (!config.quality) {
        config.quality = { strict: true, autoVerify: true };
      }
      config.stacks = detectedStacks;
      config.details = stackDetails;
      config.references = references;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e: unknown) {
      handleCaughtError('recoverable', 'Config update failed, using defaults', e, log);
    }
  } else {
    const config: VibeConfig = {
      language: detectOsLanguage(),
      quality: { strict: true, autoVerify: true },
      stacks: detectedStacks,
      details: stackDetails,
      references
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

// VIBE에서 관리하는 언어 룰 파일 패턴 (항상 업데이트)
const VIBE_MANAGED_LANGUAGE_RULES = [
  'typescript-', 'python-', 'dart-', 'go.', 'rust.', 'kotlin-',
  'java-', 'swift-', 'ruby-', 'csharp-', 'gdscript-'
];

// 레거시 파일명 (정리 대상)
const LEGACY_RULE_FILES = [
  'react-patterns.mdc', 'typescript-standards.mdc', 'python-standards.mdc'
];

/**
 * Cursor IDE 프로젝트 룰 설치
 * ~/.cursor/rules-template/에서 프로젝트의 .cursor/rules/로 복사
 * - 언어 룰 (typescript-*, python-* 등): 현재 프로젝트 스택에 해당하는 것만 설치/업데이트
 * - 공통 룰 (code-quality, security-checklist): 없을 때만 복사
 * - 사용자 룰 (packages-*, apps-* 등): 보존
 */
export function installCursorRules(projectRoot: string, detectedStacks: string[] = []): void {
  const cursorRulesTemplate = path.join(os.homedir(), '.cursor', 'rules-template');
  const projectCursorRules = path.join(projectRoot, '.cursor', 'rules');

  // 템플릿 디렉토리가 없으면 스킵
  if (!fs.existsSync(cursorRulesTemplate)) {
    return;
  }

  // 현재 프로젝트 스택에 해당하는 언어 룰 파일명 집합 생성
  const allowedLanguageFiles = new Set<string>();
  for (const stack of detectedStacks) {
    const languageFile = STACK_TO_LANGUAGE_FILE[stack.toLowerCase()];
    if (languageFile) {
      allowedLanguageFiles.add(languageFile.replace('.md', '.mdc'));
    }
  }

  // .cursor/rules 디렉토리 생성
  ensureDir(projectCursorRules);

  // 레거시 파일 정리 (이전 버전에서 생성된 파일)
  for (const legacyFile of LEGACY_RULE_FILES) {
    const legacyPath = path.join(projectCursorRules, legacyFile);
    if (fs.existsSync(legacyPath)) {
      try { fs.unlinkSync(legacyPath); } catch (e: unknown) {
        handleCaughtError('ignorable', `Removing legacy rule file ${legacyFile}`, e);
      }
    }
  }

  // 템플릿 파일 복사
  const files = fs.readdirSync(cursorRulesTemplate).filter(f => f.endsWith('.mdc'));
  let installed = 0;
  let updated = 0;
  let removed = 0;

  for (const file of files) {
    const srcPath = path.join(cursorRulesTemplate, file);
    const destPath = path.join(projectCursorRules, file);
    const isLanguageRule = VIBE_MANAGED_LANGUAGE_RULES.some(prefix => file.startsWith(prefix));
    const exists = fs.existsSync(destPath);

    if (isLanguageRule) {
      // 언어 룰: 현재 프로젝트 스택에 해당하는 것만 설치/업데이트
      if (allowedLanguageFiles.has(file)) {
        try {
          fs.copyFileSync(srcPath, destPath);
          if (exists) {
            updated++;
          } else {
            installed++;
          }
        } catch (e: unknown) {
          handleCaughtError('ignorable', `Copying cursor language rule ${file}`, e);
        }
      } else if (exists) {
        // 현재 프로젝트에 해당하지 않는 언어 룰 제거
        try {
          fs.unlinkSync(destPath);
          removed++;
        } catch (e: unknown) {
          handleCaughtError('ignorable', `Removing outdated cursor rule ${file}`, e);
        }
      }
    } else if (!exists) {
      // 공통 룰: 없을 때만 복사 (사용자 수정 보존)
      try {
        fs.copyFileSync(srcPath, destPath);
        installed++;
      } catch (e: unknown) {
        handleCaughtError('ignorable', `Copying cursor common rule ${file}`, e);
      }
    }
  }

  if (installed > 0 || updated > 0 || removed > 0) {
    const parts = [];
    if (installed > 0) parts.push(`${installed} new`);
    if (updated > 0) parts.push(`${updated} updated`);
    if (removed > 0) parts.push(`${removed} removed`);
    console.log(`   📏 Cursor rules: ${parts.join(', ')} in .cursor/rules/`);
  }
}

// ─────────── Codex / Gemini 프로젝트 레벨 설정 ───────────

const VIBE_START = '<!-- VIBE:START -->';
const VIBE_END_TAG = '<!-- VIBE:END -->';

/**
 * CLAUDE.md에서 VIBE 섹션 추출 (CLI-neutral 공통 내용)
 */
function getVibeInstructionContent(packageRoot: string): string {
  const claudeMdPath = path.join(packageRoot, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) return '';

  const content = fs.readFileSync(claudeMdPath, 'utf-8').replace(/\r\n/g, '\n');
  const startIdx = content.indexOf('# VIBE');
  const endIdx = content.indexOf('<!-- VIBE:END -->');

  if (startIdx === -1) return '';
  const endPos = endIdx !== -1 ? endIdx + '<!-- VIBE:END -->'.length : content.length;

  return content.substring(startIdx, endPos);
}

/**
 * VIBE 내용을 Codex 형식으로 변환
 */
function adaptInstructionForCodex(content: string): string {
  let adapted = content;
  adapted = adapted.replace(/\(Claude Code Exclusive\)/g, '');
  adapted = adapted.replace(/Claude Code Exclusive/g, '');
  adapted = adapted.replace(/## Hooks System\n[\s\S]*?(?=\n## )/g, '');
  adapted = adapted.replace(/~\/\.claude\//g, '~/.codex/');
  adapted = adapted.replace(/\.claude\//g, '.codex/');
  adapted = adapted.replace(/Claude Code/g, 'Codex CLI');
  return adapted.trim();
}

/**
 * VIBE 내용을 Gemini 형식으로 변환
 */
function adaptInstructionForGemini(content: string): string {
  let adapted = content;
  adapted = adapted.replace(/\(Claude Code Exclusive\)/g, '');
  adapted = adapted.replace(/Claude Code Exclusive/g, '');
  adapted = adapted.replace(/PreToolUse/g, 'BeforeTool');
  adapted = adapted.replace(/PostToolUse/g, 'AfterTool');
  adapted = adapted.replace(/UserPromptSubmit/g, 'BeforeAgent');
  adapted = adapted.replace(/\bStop\b/g, 'SessionEnd');
  adapted = adapted.replace(/~\/\.claude\//g, '~/.gemini/');
  adapted = adapted.replace(/\.claude\//g, '.gemini/');
  adapted = adapted.replace(/Claude Code/g, 'Gemini CLI');
  return adapted.trim();
}

/**
 * 프로젝트 AGENTS.md 생성/업데이트 (Codex CLI용)
 * updateClaudeMd() 패턴 재사용 — VIBE 마커 기반 교체
 */
export function updateCodexAgentsMd(projectRoot: string, detectedStacks: TechStack[]): void {
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const vibeContent = getVibeInstructionContent(packageRoot);
  if (!vibeContent) return;

  const codexContent = adaptInstructionForCodex(vibeContent);
  const agentsMdPath = path.join(projectRoot, 'AGENTS.md');

  // 스택별 언어 규칙 추가
  const languageRules = getLanguageRulesContent(detectedStacks);
  const fullContent = languageRules
    ? codexContent.replace('### Error Handling Required', languageRules + '\n\n### Error Handling Required')
    : codexContent;

  if (fs.existsSync(agentsMdPath)) {
    const existing = fs.readFileSync(agentsMdPath, 'utf-8');
    const startIdx = existing.indexOf(VIBE_START);
    const endIdx = existing.indexOf(VIBE_END_TAG);

    if (startIdx !== -1 && endIdx !== -1) {
      // 마커 기반 교체
      const before = existing.substring(0, startIdx).trimEnd();
      const after = existing.substring(endIdx + VIBE_END_TAG.length).trimStart();
      const wrapped = `${VIBE_START}\n${fullContent}\n${VIBE_END_TAG}`;
      const newContent = (before ? before + '\n\n' : '') + wrapped + (after ? '\n\n' + after : '');
      fs.writeFileSync(agentsMdPath, newContent);
    } else if (!existing.includes('/vibe.spec')) {
      // VIBE 섹션 없음 — 마커 포함하여 추가
      const wrapped = `${VIBE_START}\n${fullContent}\n${VIBE_END_TAG}`;
      fs.writeFileSync(agentsMdPath, existing.trimEnd() + '\n\n' + wrapped + '\n');
    }
  } else {
    const wrapped = `${VIBE_START}\n${fullContent}\n${VIBE_END_TAG}`;
    fs.writeFileSync(agentsMdPath, wrapped + '\n');
  }
}

/**
 * 프로젝트 GEMINI.md 생성/업데이트 (Gemini CLI용)
 * updateClaudeMd() 패턴 재사용 — VIBE 마커 기반 교체
 */
export function updateGeminiMd(projectRoot: string, detectedStacks: TechStack[]): void {
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const vibeContent = getVibeInstructionContent(packageRoot);
  if (!vibeContent) return;

  const geminiContent = adaptInstructionForGemini(vibeContent);
  const geminiMdPath = path.join(projectRoot, 'GEMINI.md');

  // 스택별 언어 규칙 추가
  const languageRules = getLanguageRulesContent(detectedStacks);
  const fullContent = languageRules
    ? geminiContent.replace('### Error Handling Required', languageRules + '\n\n### Error Handling Required')
    : geminiContent;

  if (fs.existsSync(geminiMdPath)) {
    const existing = fs.readFileSync(geminiMdPath, 'utf-8');
    const startIdx = existing.indexOf(VIBE_START);
    const endIdx = existing.indexOf(VIBE_END_TAG);

    if (startIdx !== -1 && endIdx !== -1) {
      const before = existing.substring(0, startIdx).trimEnd();
      const after = existing.substring(endIdx + VIBE_END_TAG.length).trimStart();
      const wrapped = `${VIBE_START}\n${fullContent}\n${VIBE_END_TAG}`;
      const newContent = (before ? before + '\n\n' : '') + wrapped + (after ? '\n\n' + after : '');
      fs.writeFileSync(geminiMdPath, newContent);
    } else if (!existing.includes('/vibe.spec')) {
      const wrapped = `${VIBE_START}\n${fullContent}\n${VIBE_END_TAG}`;
      fs.writeFileSync(geminiMdPath, existing.trimEnd() + '\n\n' + wrapped + '\n');
    }
  } else {
    const wrapped = `${VIBE_START}\n${fullContent}\n${VIBE_END_TAG}`;
    fs.writeFileSync(geminiMdPath, wrapped + '\n');
  }
}

/**
 * Gemini CLI 프로젝트 훅 설치 (.gemini/settings.json)
 * installProjectHooks() 패턴과 동일
 */
export function installGeminiHooks(projectRoot: string): void {
  const geminiDir = path.join(projectRoot, '.gemini');
  const settingsPath = path.join(geminiDir, 'settings.json');
  const packageRoot = path.resolve(__dirname, '..', '..', '..');
  const hooksTemplate = path.join(packageRoot, 'hooks', 'gemini-hooks.json');

  if (!fs.existsSync(hooksTemplate)) return;

  ensureDir(geminiDir);

  // 템플릿 읽고 플레이스홀더 치환
  let hooksContent = fs.readFileSync(hooksTemplate, 'utf-8');
  const corePathForUrl = getCoreConfigDir().replace(/\\/g, '/');
  hooksContent = hooksContent.replace(/\{\{VIBE_PATH\}\}/g, corePathForUrl);

  const coreHooks = JSON.parse(hooksContent);

  if (fs.existsSync(settingsPath)) {
    try {
      const existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      existingSettings.hooks = coreHooks.hooks;
      fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
    } catch (e: unknown) {
      handleCaughtError('recoverable', 'Parsing existing Gemini settings failed, recreating', e, log);
      fs.writeFileSync(settingsPath, JSON.stringify(coreHooks, null, 2));
    }
  } else {
    fs.writeFileSync(settingsPath, JSON.stringify(coreHooks, null, 2));
  }
}
