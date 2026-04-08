/**
 * init 명령어
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { CliOptions } from '../types.js';
import { log, ensureDir, getPackageJson } from '../utils.js';
import { detectTechStacks } from '../detect.js';
import { formatLLMStatus, getClaudeCodeStatus } from '../auth.js';
import { setupCollaboratorAutoInstall } from '../collaborator.js';
import {
  updateConstitution,
  updateRules,
  migrateLegacyCore,
  updateGitignore,
  updateConfig,
  installProjectHooks,
  installCursorRules,
  updateCodexAgentsMd,
  updateGeminiMd,
  installGeminiHooks,
  detectOsLanguage,
} from '../setup.js';
import * as p from '@clack/prompts';
import {
  installCursorAgents,
  generateCursorRules,
  generateCursorSkills,
  installCodexPlugin,
  installGeminiAgents,
  generateGeminiMd,
  resolveLocalSkills,
  copySkillsFiltered,
  AVAILABLE_CAPABILITIES,
  STACK_TO_LANGUAGE_FILE,
  GLOBAL_SKILLS,
} from '../postinstall.js';
import { detectCodexCli, detectGeminiCli } from '../utils/cli-detector.js';
import { Provisioner } from '../setup/Provisioner.js';
import { installExternalSkills } from './skills.js';

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
 * Update global Codex CLI assets (agents, skills, AGENTS.md)
 * Called by both init and update
 */
export function updateCodexGlobalAssets(
  detectedStacks: string[] = [],
  options: CliOptions = { silent: false }
): void {
  try {
    const codexStatus = detectCodexCli();
    if (!codexStatus.installed) return;

    const __dir = path.dirname(new URL(import.meta.url).pathname);
    const packageRoot = path.resolve(__dir, '..', '..', '..');
    const agentsSource = path.join(packageRoot, 'agents');
    const skillsSource = path.join(packageRoot, 'skills');

    // Codex 플러그인 설치 (agents + skills + manifest + AGENTS.md)
    installCodexPlugin(agentsSource, skillsSource, codexStatus.configDir, packageRoot);
  } catch (err) {
    if (!options.silent) {
      console.warn(`   ⚠️ Codex plugin update warning: ${(err as Error).message}`);
    }
  }
}

/**
 * Update global Gemini CLI assets (agents, skills, GEMINI.md)
 * Called by both init and update
 */
export function updateGeminiGlobalAssets(
  detectedStacks: string[] = [],
  options: CliOptions = { silent: false }
): void {
  try {
    const geminiStatus = detectGeminiCli();
    if (!geminiStatus.installed) return;

    const __dir = path.dirname(new URL(import.meta.url).pathname);
    const packageRoot = path.resolve(__dir, '..', '..', '..');
    const agentsSource = path.join(packageRoot, 'agents');
    const skillsSource = path.join(packageRoot, 'skills');

    // Gemini agents (전체)
    if (fs.existsSync(agentsSource)) {
      installGeminiAgents(agentsSource, path.join(geminiStatus.configDir, 'agents'));
    }

    // Gemini skills (전역 공통)
    if (fs.existsSync(skillsSource)) {
      copySkillsFiltered(skillsSource, path.join(geminiStatus.configDir, 'skills'), GLOBAL_SKILLS);
    }

    // Gemini GEMINI.md (전역)
    generateGeminiMd(geminiStatus.configDir, packageRoot);
  } catch (err) {
    if (!options.silent) {
      console.warn(`   ⚠️ Gemini assets update warning: ${(err as Error).message}`);
    }
  }
}

/**
 * 스택 + capability 기반 로컬 스킬 설치 (.claude/skills/)
 * init, update 공용
 */
export function installLocalSkills(
  projectRoot: string,
  stackTypes: string[],
  capabilities: string[] = [],
): void {
  const localSkills = resolveLocalSkills(stackTypes, capabilities);
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
 * 감지된 스택에 해당하는 언어 룰 파일을 프로젝트 로컬에 설치
 * 전역 ~/.claude/vibe/languages/ → 프로젝트 .claude/vibe/languages/
 */
export function installLanguageRules(
  projectRoot: string,
  stackTypes: string[],
): void {
  const globalLanguagesDir = path.join(os.homedir(), '.claude', 'vibe', 'languages');
  if (!fs.existsSync(globalLanguagesDir)) return;

  // 감지된 스택에 해당하는 언어 파일만 선별
  const languageFiles = new Set<string>();
  for (const stack of stackTypes) {
    const file = STACK_TO_LANGUAGE_FILE[stack];
    if (file) languageFiles.add(file);
  }
  if (languageFiles.size === 0) return;

  const localLanguagesDir = path.join(projectRoot, '.claude', 'vibe', 'languages');
  ensureDir(localLanguagesDir);

  const installed: string[] = [];
  for (const file of languageFiles) {
    const src = path.join(globalLanguagesDir, file);
    const dest = path.join(localLanguagesDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      installed.push(file);
    }
  }

  if (installed.length > 0) {
    log(`   📝 Language rules installed: ${installed.join(', ')}\n`);
  }
}

/**
 * Run a named init step, logging warning and continuing on non-critical failure.
 */
function runStep(
  s: { message(msg: string): void },
  name: string,
  fn: () => void,
): void {
  s.message(name);
  try {
    fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    p.log.warn(`${name} - skipped: ${msg}`);
  }
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

    // ── Phase 1: Detection ──────────────────────────────────
    p.log.step('Phase 1/3: Detection');
    const s = p.spinner();

    s.start('Migrating legacy config');
    runStep(s, 'Legacy migration', () => migrateLegacyCore(projectRoot, coreDir));
    runStep(s, 'Updating .gitignore', () => updateGitignore(projectRoot));

    s.message('Detecting tech stacks');
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);
    s.stop('Stack detection complete');

    if (detectedStacks.length > 0) {
      log(`   🔍 Detected stacks:\n`);
      detectedStacks.forEach(st => {
        log(`      - ${st.type}${st.path ? ` (${st.path}/)` : ''}\n`);
      });
      if (stackDetails.databases.length > 0) {
        log(`      - DB: ${stackDetails.databases.join(', ')}\n`);
      }
      if (stackDetails.stateManagement.length > 0) {
        log(`      - State: ${stackDetails.stateManagement.join(', ')}\n`);
      }
    }

    // Capability interactive selection
    if (stackDetails.capabilities.length === 0 && !process.env.CI && AVAILABLE_CAPABILITIES.length > 0) {
      const selected = await p.multiselect({
        message: 'Select project capabilities (Space to toggle, Enter to confirm):',
        options: [
          { value: '__none__', label: 'None', hint: 'Skip capability selection' },
          ...AVAILABLE_CAPABILITIES.map(c => ({
            value: c.value,
            label: c.label,
            hint: c.hint,
          })),
        ],
        required: false,
      });
      if (!p.isCancel(selected) && Array.isArray(selected)) {
        const filtered = (selected as string[]).filter(v => v !== '__none__');
        if (filtered.length > 0) {
          stackDetails.capabilities.push(...filtered);
        }
      }
    }

    // Devlog capability: collect config interactively
    let devlogConfig: Record<string, unknown> | undefined;
    if (stackDetails.capabilities.includes('devlog') && !process.env.CI) {
      const targetRepo = await p.text({
        message: 'Blog repo path (absolute):',
        placeholder: '/path/to/blog-repo',
        validate: (v) => {
          if (!v) return 'Required';
          if (!path.isAbsolute(v)) return 'Must be absolute path';
          if (!fs.existsSync(v)) return 'Directory not found';
          return undefined;
        },
      });
      if (!p.isCancel(targetRepo)) {
        const targetDir = await p.text({
          message: 'Posts directory:',
          defaultValue: 'posts',
          placeholder: 'posts',
        });
        const prefix = await p.text({
          message: 'File prefix:',
          defaultValue: 'devlog',
          placeholder: 'devlog',
        });
        const interval = await p.text({
          message: 'Commits per devlog:',
          defaultValue: '10',
          placeholder: '10',
          validate: (v) => {
            const n = Number(v);
            if (isNaN(n) || n < 1) return 'Must be a positive number';
            return undefined;
          },
        });
        const autoPush = await p.confirm({
          message: 'Auto commit+push to blog repo?',
          initialValue: false,
        });

        devlogConfig = {
          enabled: true,
          targetRepo: targetRepo as string,
          targetDir: p.isCancel(targetDir) ? 'posts' : (targetDir as string || 'posts'),
          prefix: p.isCancel(prefix) ? 'devlog' : (prefix as string || 'devlog'),
          interval: p.isCancel(interval) ? 10 : Number(interval) || 10,
          autoPush: p.isCancel(autoPush) ? false : autoPush,
          lang: detectOsLanguage(),
        };
      }
    }

    // ── Phase 2: Configuration ──────────────────────────────
    p.log.step('Phase 2/3: Configuration');
    const s2 = p.spinner();
    s2.start('Generating project config');

    runStep(s2, 'Creating constitution.md', () => updateConstitution(coreDir, detectedStacks, stackDetails));
    runStep(s2, 'Creating config.json', () => {
      updateConfig(coreDir, detectedStacks, stackDetails, false);
      if (devlogConfig) {
        const configPath = path.join(coreDir, 'config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config.devlog = devlogConfig;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    });
    runStep(s2, 'Copying rules', () => updateRules(coreDir, detectedStacks, false));
    runStep(s2, 'Setting up collaborator auto-install', () => setupCollaboratorAutoInstall(projectRoot));

    s2.stop('Configuration complete');

    // ── Phase 3: Installation ───────────────────────────────
    p.log.step('Phase 3/3: Installation');
    const s3 = p.spinner();
    s3.start('Installing project hooks');

    const stackTypes = detectedStacks.map(st => st.type);

    runStep(s3, 'Installing project hooks', () => installProjectHooks(projectRoot));
    runStep(s3, 'Updating Cursor global assets', () => updateCursorGlobalAssets(stackTypes));
    runStep(s3, 'Installing Cursor rules', () => installCursorRules(projectRoot, stackTypes));
    runStep(s3, 'Installing language rules', () => installLanguageRules(projectRoot, stackTypes));

    // Codex CLI
    runStep(s3, 'Checking Codex CLI', () => {
      const codexStatus = detectCodexCli();
      if (codexStatus.installed) {
        updateCodexGlobalAssets(stackTypes);
        updateCodexAgentsMd(projectRoot, detectedStacks);
        log(`   📝 AGENTS.md generated (Codex)\n`);
      }
    });

    // Gemini CLI
    runStep(s3, 'Checking Gemini CLI', () => {
      const geminiStatus = detectGeminiCli();
      if (geminiStatus.installed) {
        updateGeminiGlobalAssets(stackTypes);
        updateGeminiMd(projectRoot, detectedStacks);
        installGeminiHooks(projectRoot);
        log(`   📝 GEMINI.md + hooks generated (Gemini)\n`);
      }
    });

    runStep(s3, 'Installing local skills', () => {
      installLocalSkills(projectRoot, stackTypes, stackDetails.capabilities);
    });

    runStep(s3, 'Installing external skills', () => {
      installExternalSkills(projectRoot, stackTypes, stackDetails.capabilities);
    });

    if (stackDetails.capabilities.length > 0) {
      log(`      - Capabilities: ${stackDetails.capabilities.join(', ')}\n`);
    }

    runStep(s3, 'Provisioning agents & templates', () => {
      const provisionResult = Provisioner.provision(projectRoot, detectedStacks, stackDetails);
      if (provisionResult.agentsGenerated) {
        log(`   🤖 Recommended agents generated\n`);
      }
      if (provisionResult.specTemplateGenerated) {
        log(`   📋 SPEC template generated\n`);
      }
    });

    s3.stop('Installation complete');

    // 완료 메시지
    const packageJson = getPackageJson();

    const claudeStatus = getClaudeCodeStatus(true);
    log(`✅ vibe initialized (v${packageJson.version})
${formatLLMStatus(claudeStatus)}
📦 Context7 plugin (recommended): /plugin install context7

Next: ${isNewProject ? `cd ${projectName} && ` : ''}/vibe.spec "feature"
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Init failed:', message);
    process.exit(1);
  }
}
