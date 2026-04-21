/**
 * ProjectSetup - 프로젝트 레벨 설정
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { VibeConfig, VibeReferences, TechStack, StackDetails } from '../types.js';
import { ensureDir, removeDirRecursive, log } from '../utils.js';
import { STACK_NAMES } from '../detect.js';
import { STACK_TO_LANGUAGE_FILE } from '../postinstall.js';
import { detectOsLanguage } from './LanguageDetector.js';
import { getCoreConfigDir } from './GlobalInstaller.js';
import { handleCaughtError } from '../../infra/lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VIBE 섹션 감싸는 마커 — CLAUDE.md/AGENTS.md 둘 다 이 마커 사이를 재생성.
const VIBE_START = '<!-- VIBE:START -->';
const VIBE_END_TAG = '<!-- VIBE:END -->';

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
 * VIBE 섹션을 파일에 쓰기 — START/END 마커 기반 idempotent 갱신
 */
function writeVibeMarkedFile(
  filePath: string,
  section: string,
  createIfMissing: boolean = true,
): void {
  const wrapped = `${VIBE_START}\n${section}\n${VIBE_END_TAG}`;

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    const startIdx = existing.indexOf(VIBE_START);
    const legacyStartIdx = existing.indexOf('# VIBE');
    const endIdx = existing.indexOf(VIBE_END_TAG);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const before = existing.substring(0, startIdx).trimEnd();
      const after = existing.substring(endIdx + VIBE_END_TAG.length).trimStart();
      fs.writeFileSync(filePath, (before ? before + '\n\n' : '') + wrapped + (after ? '\n\n' + after : ''));
    } else if (legacyStartIdx !== -1 && endIdx !== -1) {
      const before = existing.substring(0, legacyStartIdx).trimEnd();
      const after = existing.substring(endIdx + VIBE_END_TAG.length).trimStart();
      fs.writeFileSync(filePath, (before ? before + '\n\n' : '') + wrapped + (after ? '\n\n' + after : ''));
    } else if (legacyStartIdx !== -1) {
      const before = existing.substring(0, legacyStartIdx).trimEnd();
      fs.writeFileSync(filePath, (before ? before + '\n\n' : '') + wrapped);
    } else {
      fs.writeFileSync(filePath, existing.trimEnd() + '\n\n' + wrapped + '\n');
    }
  } else if (createIfMissing) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, wrapped + '\n');
  }
}

/** CLI 변환 공용 헬퍼 (Claude Code → {label}, .claude/ → {dirName}/, CLAUDE.md → {targetFile}) */
function adaptSection(section: string, label: string, dirName: string, targetFile: string): string {
  return section
    .replace(/Claude Code/g, label)
    .replace(/~\/\.claude\//g, `~/${dirName}/`)
    .replace(/\.claude\//g, `${dirName}/`)
    .replace(/`CLAUDE\.md`/g, `\`${targetFile}\``)
    .replace(new RegExp(`${dirName.replace('.', '\\.')}\\/CLAUDE\\.md`, 'g'), `${dirName}/${targetFile}`);
}

const adaptToCoco = (section: string): string => adaptSection(section, 'coco', '.coco', 'AGENTS.md');
const adaptToCodex = (section: string): string => adaptSection(section, 'Codex', '.codex', 'AGENTS.md');
const adaptToGemini = (section: string): string => adaptSection(section, 'Gemini', '.gemini', 'GEMINI.md');

/**
 * 전역 ~/.claude/CLAUDE.md 생성/갱신 — vibe 규약(룰·키워드·워크플로) 전역 주입
 */
export function generateGlobalClaudeMd(): void {
  const globalPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  const section = buildGlobalSection(detectOsLanguage());
  writeVibeMarkedFile(globalPath, section);
}

/**
 * 전역 ~/.coco/AGENTS.md 생성/갱신 (coco CLI 감지 시에만 호출)
 */
export function generateGlobalAgentsMd(): void {
  const globalPath = path.join(os.homedir(), '.coco', 'AGENTS.md');
  const section = adaptToCoco(buildGlobalSection(detectOsLanguage()));
  writeVibeMarkedFile(globalPath, section);
}

/**
 * 전역 ~/.codex/AGENTS.md 생성/갱신 (Codex CLI 감지 시에만 호출)
 */
export function generateGlobalCodexAgentsMd(): void {
  const globalPath = path.join(os.homedir(), '.codex', 'AGENTS.md');
  const section = adaptToCodex(buildGlobalSection(detectOsLanguage()));
  writeVibeMarkedFile(globalPath, section);
}

/**
 * 전역 ~/.gemini/GEMINI.md 생성/갱신 (Gemini CLI 감지 시에만 호출)
 */
export function generateGlobalGeminiMd(): void {
  const globalPath = path.join(os.homedir(), '.gemini', 'GEMINI.md');
  const section = adaptToGemini(buildGlobalSection(detectOsLanguage()));
  writeVibeMarkedFile(globalPath, section);
}

/**
 * 프로젝트 분석 → CLAUDE.md 생성/갱신 (프로젝트별 섹션만)
 * 전역 규약은 `~/.claude/CLAUDE.md`에서 별도 관리.
 */
export function generateProjectClaudeMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  createIfMissing: boolean = true,
): void {
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (!createIfMissing && !fs.existsSync(claudeMdPath)) return;
  const dirs = analyzeProjectStructure(projectRoot);
  const stackNames = detectedStacks.map(s => STACK_NAMES[s.type]?.name || s.type);
  const section = buildProjectSection(dirs, stackNames, stackDetails);
  writeVibeMarkedFile(claudeMdPath, section, createIfMissing);
}

/**
 * 프로젝트 분석 → AGENTS.md 생성/갱신 (coco / codex 용, 프로젝트별 섹션만)
 * @param createIfMissing false 시 존재하는 파일만 갱신 (update --dynamic 용)
 */
export function generateProjectAgentsMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  createIfMissing: boolean = true,
): void {
  const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
  if (!createIfMissing && !fs.existsSync(agentsMdPath)) return;

  const dirs = analyzeProjectStructure(projectRoot);
  const stackNames = detectedStacks.map(s => STACK_NAMES[s.type]?.name || s.type);
  const section = adaptToCoco(buildProjectSection(dirs, stackNames, stackDetails));

  if (!fs.existsSync(agentsMdPath)) {
    writeVibeMarkedFile(agentsMdPath, section);
    return;
  }
  const existing = fs.readFileSync(agentsMdPath, 'utf-8');
  const hasMarker = existing.includes(VIBE_START) || existing.includes('# VIBE');
  if (hasMarker || !existing.includes('/vibe.spec')) {
    writeVibeMarkedFile(agentsMdPath, section);
  }
}

/**
 * 프로젝트 분석 → GEMINI.md 생성/갱신 (Gemini CLI 용)
 * @param createIfMissing false 시 존재하는 파일만 갱신
 */
export function generateProjectGeminiMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  createIfMissing: boolean = true,
): void {
  const geminiMdPath = path.join(projectRoot, 'GEMINI.md');
  if (!createIfMissing && !fs.existsSync(geminiMdPath)) return;

  const dirs = analyzeProjectStructure(projectRoot);
  const stackNames = detectedStacks.map(s => STACK_NAMES[s.type]?.name || s.type);
  const section = adaptToGemini(buildProjectSection(dirs, stackNames, stackDetails));
  writeVibeMarkedFile(geminiMdPath, section, createIfMissing);
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
    .filter(f => !f.startsWith('.') || f === '.dev' || f === '.vibe' || f === '.claude' || f === '.coco')
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

/** 전역 VIBE 규약 섹션 (프로젝트 독립) — ~/.claude/CLAUDE.md, ~/.coco/AGENTS.md */
function buildGlobalSection(language: string): string {
  const lines: string[] = [];

  lines.push('# VIBE');
  lines.push('');
  lines.push('> Global vibe conventions — shared across all projects using Claude Code.');
  lines.push('> Project-specific stack/structure lives in each project\'s `CLAUDE.md`.');
  lines.push('');
  if (language === 'ko') {
    lines.push('**IMPORTANT: Always respond in Korean (한국어) unless the user explicitly requests otherwise.**');
    lines.push('');
  }

  lines.push('## Constraints');
  lines.push('');
  lines.push('- Modify only requested scope');
  lines.push('- Preserve existing style');
  lines.push('- Prefer editing existing files for modifications');
  lines.push('- Create new files when the task requires them (user asks for a feature/module/scaffold) — an explicit user request overrides this default');
  lines.push('- Function ≤50 lines, nesting ≤3, params ≤5, complexity ≤10');
  lines.push('- No `any`, no `console.log` in commits, no commented-out code');
  lines.push('');
  lines.push('### Optimization Rules (Rob Pike)');
  lines.push('');
  lines.push('- Never optimize without measuring first');
  lines.push('- Don\'t tune unless one part overwhelms the rest');
  lines.push('- Fancy algorithms are slow when n is small — and n is usually small');
  lines.push('- Simple code beats clever code. Data dominates.');
  lines.push('');
  lines.push('### Debugging Rules');
  lines.push('');
  lines.push('- Never fix before reproducing the failure');
  lines.push('- State a root-cause hypothesis before changing code');
  lines.push('- Write a failing test before fixing');
  lines.push('- One hypothesis at a time. No "while I\'m here" refactoring.');
  lines.push('- 3 failed fixes → suspect structural issue, stop patching');
  lines.push('');

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

  lines.push('## Keywords');
  lines.push('');
  lines.push('`ultrawork` parallel+auto | `ralph` loop until 100% | `quick` fast mode');
  lines.push('');

  lines.push('## Quality');
  lines.push('');
  lines.push('Convergence: loop until P1=0. Changed files only.');
  lines.push('At 70%+ context: save_memory → /new → /vibe.utils --continue');
  lines.push('');

  lines.push('## Git');
  lines.push('');
  lines.push('Include: `.vibe/{plans,specs,features,todos,config.json,constitution.md}`, `CLAUDE.md`');
  lines.push('Exclude: `~/.claude/{rules,commands,agents,skills}/`, `.claude/settings.local.json`, `.vibe/{memories,checkpoints,metrics}/`');

  return lines.join('\n');
}

/** 프로젝트별 VIBE 섹션 (스택·구조·커맨드) — 프로젝트 루트 CLAUDE.md/AGENTS.md */
function buildProjectSection(
  dirs: ProjectDirs,
  stackNames: string[],
  stackDetails: StackDetails,
): string {
  const lines: string[] = [];

  lines.push('# VIBE (project)');
  lines.push('');
  lines.push('> Global rules: `~/.claude/CLAUDE.md`. This file is project-specific only.');
  lines.push('');

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
      case '.vibe':
        structureRows.push('| `.vibe/` | Vibe SSOT (specs, plans, memories) — Claude/coco 공용 |');
        break;
      case 'tests': case '__tests__': case 'test':
        structureRows.push(`| \`${dir}/\` | Test infrastructure |`);
        break;
      case '.claude':
        structureRows.push('| `.claude/` | Claude Code CLI 설정 |');
        break;
      case '.coco':
        structureRows.push('| `.coco/` | coco CLI 설정 |');
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

  if (dirs.srcChildren.length > 0) {
    lines.push(`### Source layout: ${dirs.srcChildren.map(d => `${d}/`).join(', ')}`);
    lines.push('');
  }

  if (dirs.buildCommand || dirs.testCommand) {
    lines.push('## Commands');
    lines.push('');
    if (dirs.buildCommand) lines.push(`- Build: \`${dirs.buildCommand}\``);
    if (dirs.testCommand) lines.push(`- Test: \`${dirs.testCommand}\``);
    lines.push('');
  }

  lines.push('## References');
  lines.push('');
  lines.push('- Rules: `.vibe/config.json` → `references.rules[]`');
  lines.push('- Languages: `~/.claude/vibe/languages/` (global)');
  lines.push('- Constitution: `.vibe/constitution.md`');
  if (dirs.hasDocs) lines.push('- Business docs: `docs/`');

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
 * 프로젝트 레벨 훅 설치 (.claude/settings.local.json 또는 .coco/settings.local.json)
 *
 * @param projectRoot 프로젝트 루트
 * @param harnessDir 하네스 디렉토리 이름 ('.claude' | '.coco', 기본값: '.claude')
 */
export function installProjectHooks(projectRoot: string, harnessDir: string = '.claude'): void {
  const claudeDir = path.join(projectRoot, harnessDir);
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
    // 기존 settings.local.json에 hooks + permissions 병합
    try {
      const existingSettings = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf-8'));
      existingSettings.hooks = coreHooks.hooks;
      existingSettings.permissions = mergePermissions(existingSettings.permissions, coreHooks.permissions);
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
 * 기존 settings.local.json 의 permissions 와 vibe 기본 permissions 를 병합.
 *  - deny: 합집합 (vibe 의 deny 는 최소 안전장치 — 사용자가 지우지 않는 한 유지)
 *  - allow / ask: 기존 사용자 설정 우선 (vibe 는 비어 있음, 덮어쓰면 사용자 설정 손실)
 */
function mergePermissions(
  existing: unknown,
  vibeDefaults: { allow?: string[]; deny?: string[]; ask?: string[] } | undefined,
): { allow: string[]; deny: string[]; ask: string[] } {
  const ex = (existing && typeof existing === 'object')
    ? existing as { allow?: unknown; deny?: unknown; ask?: unknown }
    : {};
  const toArr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const dedupe = (arr: string[]): string[] => Array.from(new Set(arr));
  return {
    allow: toArr(ex.allow),
    deny: dedupe([...toArr(ex.deny), ...toArr(vibeDefaults?.deny)]),
    ask: toArr(ex.ask),
  };
}

/**
 * .gitignore 업데이트
 *
 * @param harnessDir '.claude' | '.coco' (기본값: '.claude')
 *   하네스-특정 경로(settings.local.json, checkpoints/)는 해당 디렉토리에 쓰기 위해 사용.
 */
export function updateGitignore(projectRoot: string, harnessDir: string = '.claude'): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) return;

  let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  let modified = false;

  // settings.local.json 추가
  const settingsPath = `${harnessDir}/settings.local.json`;
  if (!gitignore.includes(settingsPath)) {
    gitignore = gitignore.trimEnd() + `\n\n# core project hooks (personal)\n${settingsPath}\n`;
    modified = true;
  }

  // .gemini/settings.json 추가 (Gemini CLI hooks - 개인 설정)
  if (!gitignore.includes('.gemini/settings.json')) {
    gitignore = gitignore.trimEnd() + '\n\n# Gemini CLI hooks (personal)\n.gemini/settings.json\n';
    modified = true;
  }

  // checkpoints 디렉토리 제외 (Phase Isolation Protocol 임시 파일) — .vibe/ SSOT
  const checkpointsPath = `.vibe/checkpoints/`;
  if (!gitignore.includes(checkpointsPath)) {
    gitignore = gitignore.trimEnd() + `\n\n# Phase checkpoints (ephemeral)\n${checkpointsPath}\n`;
    modified = true;
  }

  // 메모리 DB 제외 — 바이너리 SQLite 파일, 프로젝트마다 다름
  if (!gitignore.includes('.vibe/memories/')) {
    gitignore = gitignore.trimEnd() + '\n\n# Project memory DB (local)\n.vibe/memories/\n';
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
 * harnessDir(.claude/.coco/.codex/.gemini) → 글로벌 vibe 에셋 경로 접두사
 */
function resolveGlobalCoreDir(harnessDir: string): string {
  const name = harnessDir.startsWith('.') ? harnessDir : `.${harnessDir}`;
  return `~/${name}/vibe`;
}

/**
 * 스택 기반 references 생성
 */
function generateReferences(detectedStacks: TechStack[], harnessDir = '.claude'): VibeReferences {
  const globalCoreDir = resolveGlobalCoreDir(harnessDir);

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
  isUpdate = false,
  harnessDir = '.claude'
): void {
  const configPath = path.join(coreDir, 'config.json');
  const references = generateReferences(detectedStacks, harnessDir);

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

