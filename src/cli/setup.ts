/**
 * init/update 공통 설정 함수
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { VibeConfig, TechStack, StackDetails } from './types.js';
import { log, ensureDir, copyDirRecursive, removeDirRecursive } from './utils.js';
import { registerMcp, unregisterMcp } from './mcp.js';
import { STACK_NAMES, getLanguageRulesContent } from './detect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MCP 서버 등록
// ============================================================================

/**
 * MCP 서버 등록 (context7만 유지, GPT/Gemini는 Hook으로 대체)
 */
export function registerMcpServers(isUpdate = false): void {
  // 레거시 MCP 제거 (vibe, vibe-gemini, vibe-gpt)
  unregisterMcp('vibe');
  unregisterMcp('vibe-gemini');
  unregisterMcp('vibe-gpt');

  if (isUpdate) {
    unregisterMcp('context7');
  }

  // context7 MCP만 등록 (라이브러리 문서 검색용)
  try {
    registerMcp('context7', { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] });
    log(isUpdate ? '   ✅ context7 MCP 전역 등록 완료\n' : '   ✅ Context7 MCP 등록 완료 (라이브러리 문서 검색)\n');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('already exists')) {
      log('   ℹ️  Context7 MCP 이미 등록됨\n');
    } else {
      log('   ⚠️  Context7 MCP 수동 등록 필요\n');
    }
  }

  log('   ℹ️  GPT/Gemini는 Hook으로 직접 호출 (MCP 불필요)\n');
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
  const templatePath = path.join(__dirname, '../../templates/constitution-template.md');
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
    stackDetails.databases.length > 0 ? `- Database: ${stackDetails.databases.join(', ')}` : '- Database: (프로젝트에 맞게 설정)'
  );
  constitution = constitution.replace(
    '- State Management: {Provider / Redux / etc.}',
    stackDetails.stateManagement.length > 0 ? `- State Management: ${stackDetails.stateManagement.join(', ')}` : '- State Management: (프로젝트에 맞게 설정)'
  );
  constitution = constitution.replace(
    '- Hosting: {Cloud Run / Vercel / etc.}',
    stackDetails.hosting.length > 0 ? `- Hosting: ${stackDetails.hosting.join(', ')}` : '- Hosting: (프로젝트에 맞게 설정)'
  );
  constitution = constitution.replace(
    '- CI/CD: {GitHub Actions / etc.}',
    stackDetails.cicd.length > 0 ? `- CI/CD: ${stackDetails.cicd.join(', ')}` : '- CI/CD: (프로젝트에 맞게 설정)'
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
      '### 에러 처리 필수',
      languageRules + '\n\n### 에러 처리 필수'
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
        log('   ✅ CLAUDE.md vibe 섹션 업데이트 완료\n');
      } else if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
        log('   ✅ CLAUDE.md에 vibe 섹션 추가\n');
      } else {
        log('   ℹ️  CLAUDE.md vibe 섹션 유지\n');
      }
    } else {
      // init: 없으면 추가
      if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
        log('   ✅ CLAUDE.md에 vibe 섹션 추가\n');
      } else {
        log('   ℹ️  CLAUDE.md에 vibe 섹션 이미 존재\n');
      }
    }
  } else {
    fs.writeFileSync(projectClaudeMd, vibeContent);
    log('   ✅ CLAUDE.md 생성\n');
  }
}

// ============================================================================
// 규칙 복사/업데이트
// ============================================================================

/**
 * .claude/vibe/rules/ 복사 또는 업데이트
 */
export function updateRules(vibeDir: string, detectedStacks: TechStack[], isUpdate = false): void {
  const rulesSource = path.join(__dirname, '../../.claude/vibe/rules');
  const rulesTarget = path.join(vibeDir, 'rules');

  // core, quality, standards, tools 복사
  const coreDirs = ['core', 'quality', 'standards', 'tools'];
  coreDirs.forEach(dir => {
    const src = path.join(rulesSource, dir);
    const dst = path.join(rulesTarget, dir);
    if (fs.existsSync(src)) {
      copyDirRecursive(src, dst);
    }
  });

  // languages 폴더 처리
  const langSource = path.join(rulesSource, 'languages');
  const langTarget = path.join(rulesTarget, 'languages');

  if (isUpdate && fs.existsSync(langTarget)) {
    removeDirRecursive(langTarget);
  }
  ensureDir(langTarget);

  // 감지된 스택 타입에 해당하는 언어 규칙만 복사
  const detectedTypes = new Set(detectedStacks.map(s => s.type));

  if (fs.existsSync(langSource)) {
    const langFiles = fs.readdirSync(langSource);
    langFiles.forEach(file => {
      const langType = file.replace('.md', '');
      if (detectedTypes.has(langType)) {
        fs.copyFileSync(path.join(langSource, file), path.join(langTarget, file));
      }
    });
  }

  log('   ✅ 코딩 규칙 ' + (isUpdate ? '업데이트' : '설치') + ' 완료 (.claude/vibe/rules/)\n');
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
  log('   ✅ 슬래시 커맨드 ' + (isUpdate ? '업데이트' : '설치') + ' 완료 (~/.claude/commands/)\n');

  // agents
  const globalAgentsDir = path.join(globalClaudeDir, 'agents');
  ensureDir(globalAgentsDir);
  const agentsSource = path.join(__dirname, '../../agents');
  copyDirRecursive(agentsSource, globalAgentsDir);
  log('   ✅ 서브에이전트 ' + (isUpdate ? '업데이트' : '설치') + ' 완료 (~/.claude/agents/)\n');

  // skills
  const globalSkillsDir = path.join(globalClaudeDir, 'skills');
  ensureDir(globalSkillsDir);
  const skillsSource = path.join(__dirname, '../../skills');
  if (fs.existsSync(skillsSource)) {
    copyDirRecursive(skillsSource, globalSkillsDir);
    log('   ✅ 스킬 ' + (isUpdate ? '업데이트' : '설치') + ' 완료 (~/.claude/skills/)\n');
  }

  // hooks
  const globalSettingsPath = path.join(globalClaudeDir, 'settings.json');
  const hooksTemplate = path.join(__dirname, '../../hooks/hooks.json');
  if (fs.existsSync(hooksTemplate)) {
    const vibeHooks = JSON.parse(fs.readFileSync(hooksTemplate, 'utf-8'));
    if (fs.existsSync(globalSettingsPath)) {
      const existingSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf-8'));
      existingSettings.hooks = vibeHooks.hooks;
      fs.writeFileSync(globalSettingsPath, JSON.stringify(existingSettings, null, 2));
    } else {
      fs.copyFileSync(hooksTemplate, globalSettingsPath);
    }
    log('   ✅ Hooks 설정 ' + (isUpdate ? '업데이트' : '설치') + ' 완료 (~/.claude/settings.json)\n');
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

  log('   🔄 레거시 .vibe/ 폴더 마이그레이션 중...\n');
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
    log('   ✅ .vibe/ → .claude/vibe/ 마이그레이션 완료\n');
    return true;
  } catch { /* ignore: optional operation */
    log('   ⚠️  마이그레이션 실패 - .vibe/ 폴더 수동 삭제 필요\n');
    return false;
  }
}

// ============================================================================
// .gitignore 업데이트
// ============================================================================

/**
 * .gitignore 업데이트 (vibe MCP 제외, settings.local.json 제거)
 */
export function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const mcpIgnore = '.claude/vibe/mcp/';

  let gitignore = '';
  if (fs.existsSync(gitignorePath)) {
    gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  }

  let modified = false;

  // mcp 폴더 제외 추가
  if (!gitignore.includes(mcpIgnore)) {
    gitignore += `\n# vibe MCP\n${mcpIgnore}\n`;
    modified = true;
  }

  // settings.local.json 제거
  if (gitignore.includes('settings.local.json')) {
    gitignore = gitignore.replace(/\.claude\/settings\.local\.json\n?/g, '');
    gitignore = gitignore.replace(/settings\.local\.json\n?/g, '');
    modified = true;
    log('   ✅ .gitignore에서 settings.local.json 제거\n');
  }

  if (modified) {
    fs.writeFileSync(gitignorePath, gitignore);
  }
}

// ============================================================================
// config.json 생성/업데이트
// ============================================================================

/**
 * config.json 생성 또는 업데이트
 */
export function updateConfig(
  vibeDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails,
  isUpdate = false
): void {
  const configPath = path.join(vibeDir, 'config.json');

  if (isUpdate && fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.stacks = detectedStacks;
      config.details = stackDetails;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore: optional operation */ }
  } else {
    const config: VibeConfig = {
      language: 'ko',
      quality: { strict: true, autoVerify: true },
      stacks: detectedStacks,
      details: stackDetails
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
    log('   🔄 마이그레이션: .agent/rules/ → .claude/vibe/rules/\n');
    removeDirRecursive(oldRulesDir);
    if (fs.existsSync(oldAgentDir) && fs.readdirSync(oldAgentDir).length === 0) {
      fs.rmdirSync(oldAgentDir);
    }
    log('   ✅ 기존 .agent/rules/ 폴더 정리 완료\n');
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
      const name = path.basename(asset.path);
      log(`   🧹 프로젝트 로컬 ${name}${asset.isDir ? '/' : ''} 제거 (전역으로 이동)\n`);
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
              log(`   🧹 ${projectPath}: 로컬 vibe MCP 제거\n`);
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
      log('   ✅ ~/.claude.json 로컬 MCP 설정 정리 완료\n');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log('   ⚠️  ~/.claude.json 정리 실패: ' + message + '\n');
  }
}

/**
 * 레거시 mcp/ 폴더 정리
 */
export function cleanupLegacyMcp(vibeDir: string): void {
  const oldMcpDir = path.join(vibeDir, 'mcp');
  if (fs.existsSync(oldMcpDir)) {
    log('   🧹 기존 mcp/ 폴더 정리 중...\n');
    try {
      removeDirRecursive(oldMcpDir);
      log('   ✅ mcp/ 폴더 삭제 완료\n');
    } catch { /* ignore: optional operation */
      log('   ⚠️  mcp/ 폴더 수동 삭제 필요\n');
    }
  }
}
