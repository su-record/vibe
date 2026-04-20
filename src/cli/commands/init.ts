/**
 * init 명령어
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { CliOptions } from '../types.js';
import { log, ensureDir, getPackageJson } from '../utils.js';
import { detectTechStacks } from '../detect.js';
import { formatLLMStatus } from '../auth.js';
import { setupCollaboratorAutoInstall } from '../collaborator.js';
import {
  updateConstitution,
  updateRules,
  migrateLegacyCore,
  updateGitignore,
  updateConfig,
  installProjectHooks,
  installCursorRules,
  detectOsLanguage,
  generateProjectClaudeMd,
  generateProjectAgentsMd,
  generateGlobalClaudeMd,
  generateGlobalAgentsMd,
  generateGlobalCodexAgentsMd,
  generateGlobalGeminiMd,
  consolidateLegacyVibe,
} from '../setup.js';
import * as p from '@clack/prompts';
import {
  installCursorAgents,
  generateCursorRules,
  generateCursorSkills,
  resolveLocalSkills,
  copySkillsFiltered,
  AVAILABLE_CAPABILITIES,
  STACK_TO_LANGUAGE_FILE,
} from '../postinstall.js';
import { detectCocoCli, detectCodexCli, detectGeminiCli } from '../utils/cli-detector.js';
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
 * 스택 + capability 기반 로컬 스킬 설치 (.claude/skills/ 또는 .coco/skills/)
 * init, update 공용
 *
 * @param harnessDir '.claude' | '.coco' (기본값: '.claude')
 */
export function installLocalSkills(
  projectRoot: string,
  stackTypes: string[],
  capabilities: string[] = [],
  harnessDir: string = '.claude',
): void {
  const localSkills = resolveLocalSkills(stackTypes, capabilities);
  if (localSkills.length === 0) return;

  const __dir = path.dirname(new URL(import.meta.url).pathname);
  const packageRoot = path.resolve(__dir, '..', '..', '..');
  const skillsSource = path.join(packageRoot, 'skills');
  if (!fs.existsSync(skillsSource)) return;

  const localSkillsDir = path.join(projectRoot, harnessDir, 'skills');
  copySkillsFiltered(skillsSource, localSkillsDir, localSkills);
  log(`   📦 Local skills installed: ${localSkills.join(', ')}\n`);
}

/**
 * 감지된 스택에 해당하는 언어 룰 파일을 프로젝트 로컬에 설치
 * 전역 ~/.<harness>/vibe/languages/ (fallback: ~/.claude/vibe/languages/) → 프로젝트 `.vibe/languages/`
 *
 * @param harnessDir 전역 소스 탐색용 하네스. 설치 대상은 항상 `.vibe/`.
 */
export function installLanguageRules(
  projectRoot: string,
  stackTypes: string[],
  harnessDir: string = '.claude',
): void {
  const harnessGlobalDir = path.join(os.homedir(), harnessDir, 'vibe', 'languages');
  const claudeGlobalDir = path.join(os.homedir(), '.claude', 'vibe', 'languages');
  const globalLanguagesDir = fs.existsSync(harnessGlobalDir) ? harnessGlobalDir : claudeGlobalDir;
  if (!fs.existsSync(globalLanguagesDir)) return;

  // 감지된 스택에 해당하는 언어 파일만 선별
  const languageFiles = new Set<string>();
  for (const stack of stackTypes) {
    const file = STACK_TO_LANGUAGE_FILE[stack];
    if (file) languageFiles.add(file);
  }
  if (languageFiles.size === 0) return;

  const localLanguagesDir = path.join(projectRoot, '.vibe', 'languages');
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
 *
 * @param projectName 새 프로젝트 디렉토리 이름 (생략 시 cwd 사용)
 * @param target 초기화 대상 하네스. 'cc' → `.claude/vibe/` (기본), 'coco' → `.coco/vibe/`.
 *               CLAUDE.md ↔ AGENTS.md 피어 구조의 project 쪽 대응. 양쪽 다 원하면 두 번 실행.
 */
export async function init(
  projectName?: string,
  target: 'cc' | 'coco' = 'cc',
): Promise<void> {
  try {
    const harnessDir = target === 'coco' ? '.coco' : '.claude';
    const harnessLabel = target === 'coco' ? 'coco' : 'Claude Code';

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

    const claudeDir = path.join(projectRoot, harnessDir);
    const coreDir = path.join(projectRoot, '.vibe');
    if (fs.existsSync(coreDir)) {
      log(`❌ .vibe/ already exists.`);
      return;
    }

    // Legacy SSOT 통합 — `.claude/vibe/`, `.coco/vibe/`, `.claude/memories/`, `.coco/memories/` → `.vibe/`
    ensureDir(coreDir);
    const consolidated = consolidateLegacyVibe(projectRoot);
    if (consolidated.length > 0) {
      log(`📦 Consolidated into .vibe/: ${consolidated.join(', ')}\n`);
    }
    log(`🎯 Target harness: ${harnessLabel} (${harnessDir}/ — CLI 설정)\n`);
    log(`   Vibe SSOT: .vibe/ (공용)\n`);

    // ── Phase 1: Detection ──────────────────────────────────
    p.log.step('Phase 1/3: Detection');
    const s = p.spinner();

    s.start('Migrating legacy config');
    runStep(s, 'Legacy migration', () => migrateLegacyCore(projectRoot, coreDir));
    runStep(s, 'Updating .gitignore', () => updateGitignore(projectRoot, harnessDir));

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

    // docs/, .dev/, .vibe/ scaffolding (only for new or empty projects)
    runStep(s2, 'Creating docs/, .dev/, .vibe/ directories', () => {
      const docsDir = path.join(projectRoot, 'docs');
      const devDir = path.join(projectRoot, '.dev');

      if (!fs.existsSync(docsDir)) {
        ensureDir(docsDir);
        ensureDir(path.join(docsDir, 'adr'));
        fs.writeFileSync(
          path.join(docsDir, 'README.md'),
          '# docs/\n\nBusiness documents maintained by humans.\nAI reads these before starting work.\n\n- Business rules & domain definitions\n- Checklists & onboarding guides\n- ADR (Architecture Decision Records)\n- API specs & external integration specs\n',
        );
      }

      if (!fs.existsSync(devDir)) {
        ensureDir(devDir);
        ensureDir(path.join(devDir, 'learnings'));
        ensureDir(path.join(devDir, 'scratch'));
        fs.writeFileSync(
          path.join(devDir, 'README.md'),
          '# .dev/\n\nAI-generated work logs and scratch files.\n\n- `learnings/` — Troubleshooting records, debugging history\n- `scratch/` — Experiments, scratchpad (gitignored)\n',
        );
      }

      // .vibe/ 표준 하위 디렉토리 (SSOT — Claude/coco 공용)
      for (const sub of ['specs', 'features', 'plans', 'todos', 'memories', 'metrics']) {
        ensureDir(path.join(coreDir, sub));
      }
      const vibeReadme = path.join(coreDir, 'README.md');
      if (!fs.existsSync(vibeReadme)) {
        fs.writeFileSync(
          vibeReadme,
          '# .vibe/\n\nVibe SSOT — Claude Code / coco CLI 공용 프로젝트 에셋.\n\n- `config.json` — 프로젝트 스택/capabilities\n- `constitution.md` — 하드 룰\n- `specs/`, `plans/`, `features/`, `todos/` — 워크플로우 문서\n- `memories/` — 프로젝트 메모리 DB\n- `metrics/` — 세션/스텝 카운터\n- `scope.json` — SPEC 기반 자동 스코프 (auto=true)\n',
        );
      }
    });

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
    runStep(s2, 'Setting up collaborator auto-install', () => setupCollaboratorAutoInstall(projectRoot, harnessDir));

    s2.stop('Configuration complete');

    // ── Phase 3: Installation ───────────────────────────────
    p.log.step('Phase 3/3: Installation');
    const s3 = p.spinner();
    s3.start('Installing project hooks');

    const stackTypes = detectedStacks.map(st => st.type);

    runStep(s3, 'Installing project hooks', () => installProjectHooks(projectRoot, harnessDir));
    runStep(s3, 'Updating Cursor global assets', () => updateCursorGlobalAssets(stackTypes));
    runStep(s3, 'Installing Cursor rules', () => installCursorRules(projectRoot, stackTypes));
    runStep(s3, 'Installing language rules', () => installLanguageRules(projectRoot, stackTypes, harnessDir));

    runStep(s3, 'Installing local skills', () => {
      installLocalSkills(projectRoot, stackTypes, stackDetails.capabilities, harnessDir);
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

    // CLAUDE.md / AGENTS.md / GEMINI.md 생성
    //   전역 규약: ~/.claude/CLAUDE.md, ~/.coco/AGENTS.md, ~/.codex/AGENTS.md, ~/.gemini/GEMINI.md
    //   프로젝트별: {projectRoot}/CLAUDE.md, AGENTS.md (스택·구조·커맨드)
    // target=cc:   CLAUDE.md 쌍 + 감지된 CLI 전역 파일
    // target=coco: AGENTS.md 만 생성
    const cocoStatus = detectCocoCli();
    const codexStatus = detectCodexCli();
    const geminiStatus = detectGeminiCli();

    if (target === 'cc') {
      runStep(s3, 'Generating CLAUDE.md', () => {
        generateGlobalClaudeMd();
        generateProjectClaudeMd(projectRoot, detectedStacks, stackDetails);
        log(`   📄 CLAUDE.md generated (global rules + project)\n`);
      });

      runStep(s3, 'Generating AGENTS.md', () => {
        const hasAgentsMdCli = cocoStatus.installed || codexStatus.installed;
        if (cocoStatus.installed) generateGlobalAgentsMd();
        if (codexStatus.installed) generateGlobalCodexAgentsMd();
        if (hasAgentsMdCli) {
          generateProjectAgentsMd(projectRoot, detectedStacks, stackDetails);
          const labels = [cocoStatus.installed && 'coco', codexStatus.installed && 'codex'].filter(Boolean).join(', ');
          log(`   📄 AGENTS.md generated (${labels})\n`);
        }
      });

      if (geminiStatus.installed) {
        runStep(s3, 'Generating GEMINI.md', () => {
          generateGlobalGeminiMd();
          log(`   📄 ~/.gemini/GEMINI.md updated\n`);
        });
      }
    } else {
      runStep(s3, 'Generating AGENTS.md', () => {
        generateGlobalAgentsMd();
        if (codexStatus.installed) generateGlobalCodexAgentsMd();
        generateProjectAgentsMd(projectRoot, detectedStacks, stackDetails);
        log(`   📄 AGENTS.md generated (coco)\n`);
      });
    }

    s3.stop('Installation complete');

    // scope.json 자동 동기화 (init 시점엔 보통 SPEC 없음 → no-op)
    try {
      const __dir = path.dirname(new URL(import.meta.url).pathname);
      const packageRoot = path.resolve(__dir, '..', '..', '..');
      const scopeScript = path.join(packageRoot, 'hooks', 'scripts', 'lib', 'scope-from-spec.js');
      if (fs.existsSync(scopeScript)) {
        execSync(`node "${scopeScript}" "${projectRoot}"`, { stdio: 'inherit', timeout: 5000 });
      }
    } catch { /* best-effort */ }

    // 완료 메시지
    const packageJson = getPackageJson();

    log(`✅ vibe initialized (v${packageJson.version})
${formatLLMStatus()}
📦 Context7 plugin (recommended): /plugin install context7

Next: ${isNewProject ? `cd ${projectName} && ` : ''}/vibe.spec "feature"
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Init failed:', message);
    process.exit(1);
  }
}
