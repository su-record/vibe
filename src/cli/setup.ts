/**
 * init/update 공통 설정 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { VibeConfig, VibeReferences, TechStack, StackDetails } from './types.js';
import { log, ensureDir, copyDirRecursive, removeDirRecursive, getPackageJson } from './utils.js';
import { STACK_NAMES, getLanguageRulesContent } from './detect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// OS 언어 감지
// ============================================================================

/**
 * OS 언어 설정 감지하여 vibe 언어 반환
 * - 한국어 OS → 'ko'
 * - 그 외 → 'en' (기본값)
 */
export function detectOsLanguage(): 'ko' | 'en' {
  try {
    let locale = '';

    if (process.platform === 'win32') {
      // Windows: PowerShell로 시스템 로캘 확인
      try {
        locale = execSync('powershell -Command "[System.Globalization.CultureInfo]::CurrentCulture.Name"', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch {
        // 대안: LANG 환경변수
        locale = process.env.LANG || process.env.LC_ALL || '';
      }
    } else {
      // macOS/Linux: LANG 환경변수
      locale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
    }

    // 한국어 로캘 감지 (ko-KR, ko_KR, ko 등)
    if (locale.toLowerCase().startsWith('ko')) {
      return 'ko';
    }

    return 'en';
  } catch {
    return 'en';
  }
}

// ============================================================================
// 전역 vibe 패키지 설치
// ============================================================================

/**
 * 전역 vibe 패키지 설치 경로:
 * - Windows: %APPDATA%\vibe\ (예: C:\Users\xxx\AppData\Roaming\vibe\)
 * - macOS/Linux: ~/.config/vibe/
 * 훅에서 전역 경로로 접근할 수 있게 함 (모든 프로젝트가 공유)
 */
export function getVibeConfigDir(): string {
  if (process.platform === 'win32') {
    // Windows: APPDATA 환경변수 사용
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
  }
  // macOS/Linux: XDG 표준
  return path.join(os.homedir(), '.config', 'vibe');
}

export function installGlobalVibePackage(isUpdate = false): void {
  const globalVibeDir = getVibeConfigDir();
  const nodeModulesDir = path.join(globalVibeDir, 'node_modules');
  const vibePackageDir = path.join(nodeModulesDir, '@su-record', 'vibe');
  const packageJson = getPackageJson();
  const currentVersion = packageJson.version;

  // 이미 설치되어 있는지 확인
  const installedPackageJson = path.join(vibePackageDir, 'package.json');
  if (fs.existsSync(installedPackageJson)) {
    try {
      const installed = JSON.parse(fs.readFileSync(installedPackageJson, 'utf-8'));
      if (installed.version === currentVersion && !isUpdate) {
        return;
      }
    } catch { /* ignore: reinstall if can't read */ }
  }

  // 디렉토리 생성
  ensureDir(globalVibeDir);
  ensureDir(nodeModulesDir);
  ensureDir(path.join(nodeModulesDir, '@su-record'));

  // 기존 설치 제거
  if (fs.existsSync(vibePackageDir)) {
    removeDirRecursive(vibePackageDir);
  }

  // 1. 패키지 복사 시도 (실패해도 훅은 복사)
  try {
    const globalNpmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalNpmVibeDir = path.join(globalNpmRoot, '@su-record', 'vibe');

    if (fs.existsSync(globalNpmVibeDir)) {
      copyDirRecursive(globalNpmVibeDir, vibePackageDir);
    } else {
      execSync(`npm install @su-record/vibe@${currentVersion} --prefix "${globalVibeDir}" --no-save`, {
        stdio: 'pipe',
      });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  Package install failed: ' + message + '\n');
  }

  // 2. 훅 스크립트 복사 (패키지 복사 실패해도 실행)
  try {
    const packageRoot = path.resolve(__dirname, '..', '..');
    const installedHooksSource = path.join(vibePackageDir, 'hooks', 'scripts');
    const localHooksSource = path.join(packageRoot, 'hooks', 'scripts');
    const hooksScriptsSource = fs.existsSync(installedHooksSource) ? installedHooksSource : localHooksSource;
    const hooksScriptsTarget = path.join(globalVibeDir, 'hooks', 'scripts');

    if (fs.existsSync(hooksScriptsSource)) {
      ensureDir(path.join(globalVibeDir, 'hooks'));
      if (fs.existsSync(hooksScriptsTarget)) {
        removeDirRecursive(hooksScriptsTarget);
      }
      copyDirRecursive(hooksScriptsSource, hooksScriptsTarget);
    } else {
      log('   ⚠️  Hook scripts source not found: ' + hooksScriptsSource + '\n');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  Hook scripts copy failed: ' + message + '\n');
  }
}

// ============================================================================
// MCP 서버 등록 (레거시 - 더 이상 사용하지 않음)
// ============================================================================

/**
 * MCP 서버 정리 (no-op)
 * vibe는 더 이상 MCP를 사용하지 않음
 * context7은 사용자가 직접 플러그인으로 설치: /plugin install context7
 */
export function registerMcpServers(_isUpdate = false): void {
  // no-op: vibe는 MCP를 사용하지 않음
}

// ============================================================================
// constitution.md 생성/업데이트
// ============================================================================

/**
 * constitution.md 생성 또는 업데이트
 */
export function updateConstitution(
  vibeDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails
): void {
  const templatePath = path.join(__dirname, '../../vibe/templates/constitution-template.md');
  const constitutionPath = path.join(vibeDir, 'constitution.md');

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

// ============================================================================
// CLAUDE.md 업데이트
// ============================================================================

/**
 * CLAUDE.md 업데이트 (vibe 섹션 추가/교체)
 */
export function updateClaudeMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  isUpdate = false
): void {
  const vibeClaudeMd = path.join(__dirname, '../../CLAUDE.md');
  const projectClaudeMd = path.join(projectRoot, 'CLAUDE.md');

  if (!fs.existsSync(vibeClaudeMd)) return;

  let vibeContent = fs.readFileSync(vibeClaudeMd, 'utf-8');

  // 감지된 기술 스택에 따라 언어별 규칙 추가
  const languageRules = getLanguageRulesContent(detectedStacks);
  if (languageRules) {
    vibeContent = vibeContent.replace(
      '### Error Handling Required',
      languageRules + '\n\n### Error Handling Required'
    );
  }

  if (fs.existsSync(projectClaudeMd)) {
    const existingContent = fs.readFileSync(projectClaudeMd, 'utf-8');

    if (isUpdate) {
      // update: vibe 섹션 찾아서 교체
      const vibeStartMarker = '# VIBE';
      const sectionSeparator = '\n---\n';

      if (existingContent.includes(vibeStartMarker)) {
        const vibeStartIdx = existingContent.indexOf(vibeStartMarker);
        const beforeVibe = existingContent.substring(0, vibeStartIdx).trimEnd();
        const afterVibeStart = existingContent.substring(vibeStartIdx);
        const nextSeparatorIdx = afterVibeStart.indexOf(sectionSeparator);

        let afterVibe = '';
        if (nextSeparatorIdx !== -1) {
          afterVibe = afterVibeStart.substring(nextSeparatorIdx);
        }

        const newContent = beforeVibe + (beforeVibe ? '\n\n---\n\n' : '') + vibeContent + afterVibe;
        fs.writeFileSync(projectClaudeMd, newContent);
      } else if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
      }
    } else {
      // init: add if not exists
      if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
      }
    }
  } else {
    fs.writeFileSync(projectClaudeMd, vibeContent);
  }
}

// ============================================================================
// 규칙 복사/업데이트
// ============================================================================

/**
 * 프로젝트 vibe 폴더 설정 (rules/languages/templates는 전역 패키지 참조)
 *
 * 전역 패키지에서 참조하는 항목 (복사하지 않음):
 * - vibe/rules/       - 범용 코딩 규칙
 * - vibe/languages/   - 언어별 규칙
 * - vibe/templates/   - SPEC/Feature 템플릿
 *
 * 프로젝트에 생성하는 항목:
 * - specs/            - 생성된 SPEC 문서
 * - features/         - 생성된 BDD 시나리오
 * - config.json       - 프로젝트 설정
 * - constitution.md   - 프로젝트별 커스터마이징
 */
export function updateRules(vibeDir: string, detectedStacks: TechStack[], isUpdate = false): void {
  // 레거시 폴더 정리 (이전 버전에서 복사된 것들)
  const legacyFolders = ['rules', 'languages', 'templates'];
  legacyFolders.forEach(folder => {
    const legacyPath = path.join(vibeDir, folder);
    if (fs.existsSync(legacyPath)) {
      removeDirRecursive(legacyPath);
    }
  });

  // specs, features 폴더 확인/생성
  ['specs', 'features'].forEach(dir => {
    ensureDir(path.join(vibeDir, dir));
  });
}

// ============================================================================
// 전역 assets 설치/업데이트
// ============================================================================

/**
 * ~/.claude/ 전역 assets 설치 (commands, agents, skills, hooks)
 */
export function installGlobalAssets(isUpdate = false): void {
  const globalClaudeDir = path.join(os.homedir(), '.claude');
  ensureDir(globalClaudeDir);

  // commands
  const globalCommandsDir = path.join(globalClaudeDir, 'commands');
  ensureDir(globalCommandsDir);
  const commandsSource = path.join(__dirname, '../../commands');
  copyDirRecursive(commandsSource, globalCommandsDir);

  // agents
  const globalAgentsDir = path.join(globalClaudeDir, 'agents');
  ensureDir(globalAgentsDir);
  const agentsSource = path.join(__dirname, '../../agents');
  copyDirRecursive(agentsSource, globalAgentsDir);

  // skills
  const globalSkillsDir = path.join(globalClaudeDir, 'skills');
  ensureDir(globalSkillsDir);
  const skillsSource = path.join(__dirname, '../../skills');
  if (fs.existsSync(skillsSource)) {
    copyDirRecursive(skillsSource, globalSkillsDir);
  }

  // hooks - 템플릿에서 {{VIBE_PATH}}를 실제 경로로 치환
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');
  const hooksTemplate = path.join(__dirname, '../../hooks/hooks.json');
  if (fs.existsSync(hooksTemplate)) {
    // 템플릿 읽고 플레이스홀더 치환
    let hooksContent = fs.readFileSync(hooksTemplate, 'utf-8');
    const vibeConfigPath = getVibeConfigDir();

    // Windows 경로는 file:// URL에서 슬래시 사용해야 함
    const vibePathForUrl = vibeConfigPath.replace(/\\/g, '/');
    hooksContent = hooksContent.replace(/\{\{VIBE_PATH\}\}/g, vibePathForUrl);

    const vibeHooks = JSON.parse(hooksContent);

    if (fs.existsSync(globalSettingsPath)) {
      const existingSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf-8'));
      existingSettings.hooks = vibeHooks.hooks;
      fs.writeFileSync(globalSettingsPath, JSON.stringify(existingSettings, null, 2));
    } else {
      fs.writeFileSync(globalSettingsPath, hooksContent);
    }
  }
}

// ============================================================================
// 레거시 마이그레이션
// ============================================================================

/**
 * .vibe/ → .claude/vibe/ 마이그레이션
 */
export function migrateLegacyVibe(projectRoot: string, vibeDir: string): boolean {
  const legacyVibeDir = path.join(projectRoot, '.vibe');

  if (!fs.existsSync(legacyVibeDir)) return false;

  ensureDir(vibeDir);

  try {
    const itemsToMigrate = ['specs', 'features', 'solutions', 'todos', 'memory', 'rules', 'config.json', 'constitution.md'];
    itemsToMigrate.forEach(item => {
      const src = path.join(legacyVibeDir, item);
      const dst = path.join(vibeDir, item);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        if (fs.statSync(src).isDirectory()) {
          copyDirRecursive(src, dst);
        } else {
          fs.copyFileSync(src, dst);
        }
      }
    });
    removeDirRecursive(legacyVibeDir);
    return true;
  } catch { /* ignore: optional operation */
    return false;
  }
}

// ============================================================================
// .gitignore 업데이트
// ============================================================================

/**
 * .gitignore 업데이트 (레거시 정리)
 */
export function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  if (!fs.existsSync(gitignorePath)) return;

  let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  let modified = false;

  // 레거시 mcp 폴더 제외 제거
  if (gitignore.includes('.claude/vibe/mcp/')) {
    gitignore = gitignore.replace(/# vibe MCP\n\.claude\/vibe\/mcp\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/mcp\/\n?/g, '');
    modified = true;
  }

  // 레거시 node_modules 제외 제거 (전역으로 이동됨)
  if (gitignore.includes('.claude/vibe/node_modules/')) {
    gitignore = gitignore.replace(/# vibe local packages\n\.claude\/vibe\/node_modules\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/node_modules\/\n?/g, '');
    modified = true;
  }

  // settings.local.json 제거
  if (gitignore.includes('settings.local.json')) {
    gitignore = gitignore.replace(/\.claude\/settings\.local\.json\n?/g, '');
    gitignore = gitignore.replace(/settings\.local\.json\n?/g, '');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(gitignorePath, gitignore);
  }
}

// ============================================================================
// config.json 생성/업데이트
// ============================================================================

/**
 * 스택 기반 references 생성
 * Claude가 명시적으로 참조할 전역 문서 경로 목록
 */
function generateReferences(detectedStacks: TechStack[]): VibeReferences {
  const globalVibeDir = '~/.claude/vibe';

  // 모든 rules 문서 (core, quality, standards)
  const rules = [
    // core
    `${globalVibeDir}/rules/core/quick-start.md`,
    `${globalVibeDir}/rules/core/development-philosophy.md`,
    `${globalVibeDir}/rules/core/communication-guide.md`,
    // quality
    `${globalVibeDir}/rules/quality/checklist.md`,
    `${globalVibeDir}/rules/quality/bdd-contract-testing.md`,
    `${globalVibeDir}/rules/quality/testing-strategy.md`,
    // standards
    `${globalVibeDir}/rules/standards/anti-patterns.md`,
    `${globalVibeDir}/rules/standards/code-structure.md`,
    `${globalVibeDir}/rules/standards/complexity-metrics.md`,
    `${globalVibeDir}/rules/standards/naming-conventions.md`
  ];

  // 스택 기반 languages
  const languages = detectedStacks.map(stack =>
    `${globalVibeDir}/languages/${stack.type}.md`
  );

  // 모든 templates
  const templates = [
    `${globalVibeDir}/templates/spec-template.md`,
    `${globalVibeDir}/templates/feature-template.md`,
    `${globalVibeDir}/templates/constitution-template.md`,
    `${globalVibeDir}/templates/contract-backend-template.md`,
    `${globalVibeDir}/templates/contract-frontend-template.md`
  ];

  return { rules, languages, templates };
}

export function updateConfig(
  vibeDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  isUpdate = false
): void {
  const configPath = path.join(vibeDir, 'config.json');
  const references = generateReferences(detectedStacks);

  if (isUpdate && fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // 기존 config에 language가 없으면 추가
      if (!config.language) {
        config.language = detectOsLanguage();
      }
      // 기존 config에 quality가 없으면 추가
      if (!config.quality) {
        config.quality = { strict: true, autoVerify: true };
      }
      config.stacks = detectedStacks;
      config.details = stackDetails;
      config.references = references;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore: optional operation */ }
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

// ============================================================================
// 레거시 정리
// ============================================================================

/**
 * 레거시 파일/폴더 정리
 */
export function cleanupLegacy(projectRoot: string, claudeDir: string): void {
  // .agent/rules/ 정리
  const oldRulesDir = path.join(projectRoot, '.agent/rules');
  const oldAgentDir = path.join(projectRoot, '.agent');
  if (fs.existsSync(oldRulesDir)) {
    removeDirRecursive(oldRulesDir);
    if (fs.existsSync(oldAgentDir) && fs.readdirSync(oldAgentDir).length === 0) {
      fs.rmdirSync(oldAgentDir);
    }
  }

  // 레거시 커맨드 파일 정리
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const legacyCommands = [
      'vibe.analyze.md', 'vibe.compound.md', 'vibe.continue.md',
      'vibe.diagram.md', 'vibe.e2e.md', 'vibe.reason.md',
      'vibe.setup.md', 'vibe.ui.md'
    ];
    legacyCommands.forEach(cmd => {
      const cmdPath = path.join(commandsDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    });
  }

  // 레거시 에이전트 파일 정리
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const legacyAgents = ['reviewer.md', 'analyzer.md', 'reasoner.md'];
    legacyAgents.forEach(agent => {
      const agentPath = path.join(agentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
    });
  }

  // 프로젝트 로컬 settings.json 제거 (전역으로 이동됨)
  const localSettingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(localSettingsPath)) {
    try {
      fs.unlinkSync(localSettingsPath);
    } catch { /* ignore: optional operation */ }
  }
}

/**
 * 프로젝트 로컬 설정/자산 제거 (전역으로 이동됨)
 */
export function removeLocalAssets(claudeDir: string): void {
  const localAssets = [
    { path: path.join(claudeDir, 'settings.json'), isDir: false },
    { path: path.join(claudeDir, 'settings.local.json'), isDir: false },
    { path: path.join(claudeDir, 'commands'), isDir: true },
    { path: path.join(claudeDir, 'agents'), isDir: true },
    { path: path.join(claudeDir, 'skills'), isDir: true },
  ];

  localAssets.forEach(asset => {
    if (fs.existsSync(asset.path)) {
      if (asset.isDir) {
        removeDirRecursive(asset.path);
      } else {
        fs.unlinkSync(asset.path);
      }
    }
  });
}

/**
 * ~/.claude.json 정리 (로컬 MCP 설정 제거)
 */
export function cleanupClaudeConfig(): void {
  const claudeConfigPath = path.join(os.homedir(), '.claude.json');

  if (!fs.existsSync(claudeConfigPath)) return;

  try {
    const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf-8'));
    let configModified = false;

    if (claudeConfig.projects) {
      for (const [projectPath, projectConfig] of Object.entries(claudeConfig.projects) as [string, { mcpServers?: Record<string, { args?: string[] }> }][]) {
        if (projectConfig.mcpServers) {
          if (projectConfig.mcpServers.vibe) {
            const vibeArgs = projectConfig.mcpServers.vibe.args || [];
            const isLocalPath = vibeArgs.some((arg: string) =>
              arg.includes('.vibe/mcp/') || arg.includes('.vibe\\mcp\\')
            );
            if (isLocalPath) {
              delete projectConfig.mcpServers.vibe;
              configModified = true;
              log(`   🧹 ${projectPath}: removed local vibe MCP\n`);
            }
          }
          if (projectConfig.mcpServers['vibe-gemini']) {
            const geminiArgs = projectConfig.mcpServers['vibe-gemini'].args || [];
            const isLocalPath = geminiArgs.some((arg: string) =>
              arg.includes('.vibe/') || arg.includes('.vibe\\')
            );
            if (isLocalPath) {
              delete projectConfig.mcpServers['vibe-gemini'];
              configModified = true;
            }
          }
          if (projectConfig.mcpServers.context7) {
            delete projectConfig.mcpServers.context7;
            configModified = true;
          }
        }
      }
    }

    if (configModified) {
      fs.writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
    }
  } catch { /* ignore: optional operation */ }
}

/**
 * 레거시 mcp/ 폴더 정리
 */
export function cleanupLegacyMcp(vibeDir: string): void {
  const oldMcpDir = path.join(vibeDir, 'mcp');
  if (fs.existsSync(oldMcpDir)) {
    try {
      removeDirRecursive(oldMcpDir);
    } catch { /* ignore: optional operation */ }
  }
}
