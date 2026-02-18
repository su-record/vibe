/**
 * init 명령어
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { CliOptions } from '../types.js';
import { log, ensureDir, getPackageJson, formatVoiceHint } from '../utils.js';
import { detectTechStacks } from '../detect.js';
import { formatLLMStatus, getLLMAuthStatus, getClaudeCodeStatus } from '../auth.js';
import { setupCollaboratorAutoInstall } from '../collaborator.js';
import {
  updateConstitution,
  updateRules,
  migrateLegacyCore,
  updateGitignore,
  updateConfig,
  installProjectHooks,
  installCursorRules,
} from '../setup.js';
import {
  installCursorAgents,
  generateCursorRules,
  generateCursorSkills,
  resolveLocalSkills,
  copySkillsFiltered,
} from '../postinstall.js';

/**
 * Update global Cursor assets (agents, rules, skills)
 * Called by both init and update
 * @param detectedStacks - 감지된 기술 스택 배열 (예: ['typescript-react', 'python-fastapi'])
 */
export function updateCursorGlobalAssets(
  detectedStacks: string[] = [],
  options: CliOptions = { silent: false }
): void {
  try {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const packageRoot = path.resolve(__dirname, '..', '..', '..');
    const agentsSource = path.join(packageRoot, 'agents');

    // VIBE 언어 룰 디렉토리 (~/.claude/vibe/languages/ 또는 패키지 내 languages/)
    const globalLanguagesDir = path.join(os.homedir(), '.claude', 'vibe', 'languages');
    const packageLanguagesDir = path.join(packageRoot, 'languages');
    const languagesDir = fs.existsSync(globalLanguagesDir) ? globalLanguagesDir : packageLanguagesDir;

    // 1. Cursor agents (12 reviewers)
    const cursorAgentsDir = path.join(os.homedir(), '.cursor', 'agents');
    if (fs.existsSync(agentsSource)) {
      installCursorAgents(agentsSource, cursorAgentsDir);
    }

    // 2. Cursor rules template (VIBE 언어 룰 기반 + 공통 룰)
    const cursorRulesTemplateDir = path.join(os.homedir(), '.cursor', 'rules-template');
    generateCursorRules(cursorRulesTemplateDir, detectedStacks, languagesDir);

    // 3. Cursor skills (7 VIBE skills)
    const cursorSkillsDir = path.join(os.homedir(), '.cursor', 'skills');
    generateCursorSkills(cursorSkillsDir);

  } catch (err) {
    // Non-critical - don't fail init/update
    if (!options.silent) {
      console.warn(`   ⚠️ Cursor assets update warning: ${(err as Error).message}`);
    }
  }
}

/**
 * 스택 기반 로컬 스킬 설치 (.claude/skills/)
 * init, update 공용
 */
export function installLocalSkills(
  projectRoot: string,
  stackTypes: string[],
): void {
  const localSkills = resolveLocalSkills(stackTypes);
  if (localSkills.length === 0) return;

  const __dir = path.dirname(new URL(import.meta.url).pathname);
  const packageRoot = path.resolve(__dir, '..', '..', '..');
  const skillsSource = path.join(packageRoot, 'skills');
  if (!fs.existsSync(skillsSource)) return;

  const localSkillsDir = path.join(projectRoot, '.claude', 'skills');
  copySkillsFiltered(skillsSource, localSkillsDir, localSkills);
  log(`   📦 Local skills installed: ${localSkills.join(', ')}\n`);
}

/**
 * init 명령어 실행
 */
export async function init(projectName?: string): Promise<void> {
  try {
    let projectRoot = process.cwd();
    let isNewProject = false;

    if (projectName) {
      projectRoot = path.join(process.cwd(), projectName);

      if (fs.existsSync(projectRoot)) {
        log(`❌ Folder already exists: ${projectName}/`);
        return;
      }

      log(`📁 Creating project: ${projectName}/\n`);
      fs.mkdirSync(projectRoot, { recursive: true });
      isNewProject = true;
    }

    const claudeDir = path.join(projectRoot, '.claude');
    const coreDir = path.join(claudeDir, 'vibe');
    if (fs.existsSync(coreDir)) {
      log('❌ .claude/vibe/ already exists.');
      return;
    }

    ensureDir(coreDir);

    // 레거시 마이그레이션
    migrateLegacyCore(projectRoot, coreDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);
    if (detectedStacks.length > 0) {
      log(`   🔍 Detected stacks:\n`);
      detectedStacks.forEach(s => {
        log(`      - ${s.type}${s.path ? ` (${s.path}/)` : ''}\n`);
      });
      if (stackDetails.databases.length > 0) {
        log(`      - DB: ${stackDetails.databases.join(', ')}\n`);
      }
      if (stackDetails.stateManagement.length > 0) {
        log(`      - State: ${stackDetails.stateManagement.join(', ')}\n`);
      }
    }

    // constitution.md 생성
    updateConstitution(coreDir, detectedStacks, stackDetails);

    // config.json 생성
    updateConfig(coreDir, detectedStacks, stackDetails, false);

    // 규칙 복사
    updateRules(coreDir, detectedStacks, false);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 프로젝트 레벨 훅 설치
    installProjectHooks(projectRoot);

    // Cursor 글로벌 에셋 업데이트 (agents, skills, rules-template) - 먼저 실행!
    const stackTypes = detectedStacks.map(s => s.type);
    updateCursorGlobalAssets(stackTypes);

    // Cursor IDE 룰 설치 (프로젝트 레벨) - rules-template 생성 후 현재 스택에 해당하는 룰만 복사
    installCursorRules(projectRoot, stackTypes);

    // 스택 기반 로컬 스킬 설치 (.claude/skills/)
    installLocalSkills(projectRoot, stackTypes);

    // 완료 메시지
    const packageJson = getPackageJson();

    const authStatus = getLLMAuthStatus();
    const claudeStatus = getClaudeCodeStatus(true);
    log(`✅ vibe initialized (v${packageJson.version})
${formatLLMStatus(claudeStatus)}
${formatVoiceHint(authStatus.gemini.length > 0)}
📦 Context7 plugin (recommended): /plugin install context7

Next: ${isNewProject ? `cd ${projectName} && ` : ''}/vibe.spec "feature"
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Init failed:', message);
    process.exit(1);
  }
}
