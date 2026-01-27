/**
 * ProjectSetup - 프로젝트 레벨 설정
 * setup.ts에서 추출
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { VibeConfig, VibeReferences, TechStack, StackDetails } from '../types.js';
import { ensureDir, removeDirRecursive } from '../utils.js';
import { STACK_NAMES, getLanguageRulesContent } from '../detect.js';
import { detectOsLanguage, getLanguageInstruction } from './LanguageDetector.js';
import { getVibeConfigDir } from './GlobalInstaller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * constitution.md 생성 또는 업데이트
 */
export function updateConstitution(
  vibeDir: string,
  detectedStacks: TechStack[],
  stackDetails: StackDetails
): void {
  const templatePath = path.join(__dirname, '../../../vibe/templates/constitution-template.md');
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

/**
 * CLAUDE.md 업데이트 (vibe 섹션 추가/교체)
 */
// VIBE 섹션 마커
const VIBE_START_MARKER = '# VIBE';
const VIBE_END_MARKER = '<!-- VIBE:END -->';

export function updateClaudeMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  isUpdate = false
): void {
  const vibeClaudeMd = path.join(__dirname, '../../../CLAUDE.md');
  const projectClaudeMd = path.join(projectRoot, 'CLAUDE.md');

  if (!fs.existsSync(vibeClaudeMd)) return;

  let vibeContent = fs.readFileSync(vibeClaudeMd, 'utf-8').replace(/\r\n/g, '\n');

  // OS 언어 감지하여 응답 언어 설정 추가/교체
  const osLanguage = detectOsLanguage();
  const languageInstruction = getLanguageInstruction(osLanguage);

  // 기존 Response Language 섹션 제거 (중복 방지)
  vibeContent = vibeContent.replace(
    /\n*## Response Language\n+\*\*IMPORTANT: Always respond in (?:English|Korean \(한국어\)) unless the user explicitly requests otherwise\.\*\*/g,
    ''
  );

  // # VIBE 헤더 바로 다음에 언어 설정 추가
  vibeContent = vibeContent.replace(
    '# VIBE\n\nSPEC-driven AI Coding Framework (Claude Code Exclusive)',
    '# VIBE\n\nSPEC-driven AI Coding Framework (Claude Code Exclusive)' + languageInstruction
  );

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

    // VIBE 섹션 교체 (마커 기반)
    const vibeStartIdx = existingContent.indexOf(VIBE_START_MARKER);
    const vibeEndIdx = existingContent.indexOf(VIBE_END_MARKER);

    if (vibeStartIdx !== -1 && vibeEndIdx !== -1) {
      // 마커 기반 정확한 교체
      const beforeVibe = existingContent.substring(0, vibeStartIdx).trimEnd();
      let afterVibe = existingContent.substring(vibeEndIdx + VIBE_END_MARKER.length).trimStart();

      // afterVibe가 VIBE 중복 내용인지 확인
      // 사용자 커스텀 섹션은 보통 # 으로 시작하는 새로운 헤더로 시작함 (## 가 아닌 # 레벨)
      // --- 구분자와 빈 줄을 모두 제거하고 실제 내용 확인
      const cleanedAfterVibe = afterVibe.replace(/^(-{3,}\s*\n*)+/g, '').trimStart();

      // VIBE 관련 키워드가 있으면 중복으로 판단하여 버림
      const isVibeContent = cleanedAfterVibe.startsWith('# VIBE') ||
                           cleanedAfterVibe.startsWith('## Rule Title') ||
                           cleanedAfterVibe.startsWith('## Response Language') ||
                           cleanedAfterVibe.startsWith('## Code Quality') ||
                           cleanedAfterVibe.startsWith('title:') ||
                           cleanedAfterVibe.includes('SPEC-driven AI Coding Framework') ||
                           cleanedAfterVibe.includes('/vibe.spec') ||
                           cleanedAfterVibe.includes('ULTRAWORK');

      if (isVibeContent) {
        afterVibe = '';  // 중복 VIBE 내용 - 버림
      }

      let newContent = '';
      if (beforeVibe) {
        newContent = beforeVibe + '\n\n---\n\n' + vibeContent;
      } else {
        newContent = vibeContent;
      }
      if (afterVibe) {
        newContent += '\n\n---\n\n' + afterVibe;
      }
      fs.writeFileSync(projectClaudeMd, newContent);
    } else if (vibeStartIdx !== -1) {
      // 구버전: # VIBE는 있지만 END 마커 없음
      // VIBE 앞의 사용자 섹션만 보존하고, VIBE 이후는 전체 교체
      // (VIBE 뒤의 내용은 대부분 누적된 중복 VIBE 섹션임)
      const beforeVibe = existingContent.substring(0, vibeStartIdx).trimEnd();
      const newContent = (beforeVibe ? beforeVibe + '\n\n---\n\n' : '') + vibeContent;
      fs.writeFileSync(projectClaudeMd, newContent);
    } else if (!existingContent.includes('/vibe.spec')) {
      // VIBE 섹션 없음 - 추가
      const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
      fs.writeFileSync(projectClaudeMd, mergedContent);
    }
    // else: 이미 VIBE 관련 내용이 있지만 마커가 없는 경우 - 건드리지 않음
  } else {
    fs.writeFileSync(projectClaudeMd, vibeContent);
  }
}

/**
 * 프로젝트 vibe 폴더 설정
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
  const vibeConfigPath = getVibeConfigDir();

  // Windows 경로는 슬래시 사용
  const vibePathForUrl = vibeConfigPath.replace(/\\/g, '/');
  hooksContent = hooksContent.replace(/\{\{VIBE_PATH\}\}/g, vibePathForUrl);

  const vibeHooks = JSON.parse(hooksContent);

  if (fs.existsSync(settingsLocalPath)) {
    // 기존 settings.local.json에 hooks 병합
    try {
      const existingSettings = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf-8'));
      existingSettings.hooks = vibeHooks.hooks;
      fs.writeFileSync(settingsLocalPath, JSON.stringify(existingSettings, null, 2));
    } catch {
      // 파싱 실패시 새로 생성
      fs.writeFileSync(settingsLocalPath, JSON.stringify(vibeHooks, null, 2));
    }
  } else {
    // 새로 생성
    fs.writeFileSync(settingsLocalPath, JSON.stringify(vibeHooks, null, 2));
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
    gitignore = gitignore.trimEnd() + '\n\n# vibe project hooks (personal)\n.claude/settings.local.json\n';
    modified = true;
  }

  // 레거시 mcp 폴더 제외 제거
  if (gitignore.includes('.claude/vibe/mcp/')) {
    gitignore = gitignore.replace(/# vibe MCP\n\.claude\/vibe\/mcp\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/vibe\/mcp\/\n?/g, '');
    modified = true;
  }

  // 레거시 node_modules 제외 제거
  if (gitignore.includes('.claude/vibe/node_modules/')) {
    gitignore = gitignore.replace(/# vibe local packages\n\.claude\/vibe\/node_modules\/\n?/g, '');
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
  const globalVibeDir = '~/.claude/vibe';

  const rules = [
    `${globalVibeDir}/rules/core/quick-start.md`,
    `${globalVibeDir}/rules/core/development-philosophy.md`,
    `${globalVibeDir}/rules/core/communication-guide.md`,
    `${globalVibeDir}/rules/quality/checklist.md`,
    `${globalVibeDir}/rules/quality/bdd-contract-testing.md`,
    `${globalVibeDir}/rules/quality/testing-strategy.md`,
    `${globalVibeDir}/rules/standards/anti-patterns.md`,
    `${globalVibeDir}/rules/standards/code-structure.md`,
    `${globalVibeDir}/rules/standards/complexity-metrics.md`,
    `${globalVibeDir}/rules/standards/naming-conventions.md`
  ];

  const languages = detectedStacks.map(stack =>
    `${globalVibeDir}/languages/${stack.type}.md`
  );

  const templates = [
    `${globalVibeDir}/templates/spec-template.md`,
    `${globalVibeDir}/templates/feature-template.md`,
    `${globalVibeDir}/templates/constitution-template.md`,
    `${globalVibeDir}/templates/contract-backend-template.md`,
    `${globalVibeDir}/templates/contract-frontend-template.md`
  ];

  return { rules, languages, templates };
}

/**
 * config.json 생성/업데이트
 */
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

// VIBE에서 관리하는 언어 룰 파일 패턴 (항상 업데이트)
const VIBE_MANAGED_LANGUAGE_RULES = [
  'typescript-', 'python-', 'dart-', 'go.', 'rust.', 'kotlin-',
  'java-', 'swift-', 'ruby-', 'csharp-', 'gdscript-'
];

/**
 * Cursor IDE 프로젝트 룰 설치
 * ~/.cursor/rules-template/에서 프로젝트의 .cursor/rules/로 복사
 * - 언어 룰 (typescript-*, python-* 등): 항상 업데이트 (vibe에서 관리)
 * - 공통 룰 (code-quality, security-checklist): 없을 때만 복사
 * - 사용자 룰 (packages-*, apps-* 등): 보존
 */
export function installCursorRules(projectRoot: string): void {
  const cursorRulesTemplate = path.join(os.homedir(), '.cursor', 'rules-template');
  const projectCursorRules = path.join(projectRoot, '.cursor', 'rules');

  // 템플릿 디렉토리가 없으면 스킵
  if (!fs.existsSync(cursorRulesTemplate)) {
    return;
  }

  // .cursor/rules 디렉토리 생성
  ensureDir(projectCursorRules);

  // 템플릿 파일 복사
  const files = fs.readdirSync(cursorRulesTemplate).filter(f => f.endsWith('.mdc'));
  let installed = 0;
  let updated = 0;

  for (const file of files) {
    const srcPath = path.join(cursorRulesTemplate, file);
    const destPath = path.join(projectCursorRules, file);
    const isLanguageRule = VIBE_MANAGED_LANGUAGE_RULES.some(prefix => file.startsWith(prefix));
    const exists = fs.existsSync(destPath);

    // 언어 룰: 항상 업데이트 (vibe에서 관리하는 파일)
    // 기타 룰: 없을 때만 복사 (사용자 수정 보존)
    if (isLanguageRule || !exists) {
      try {
        fs.copyFileSync(srcPath, destPath);
        if (exists) {
          updated++;
        } else {
          installed++;
        }
      } catch {
        // 권한 문제 등 무시
      }
    }
  }

  if (installed > 0 || updated > 0) {
    const parts = [];
    if (installed > 0) parts.push(`${installed} new`);
    if (updated > 0) parts.push(`${updated} updated`);
    console.log(`   📏 Cursor rules: ${parts.join(', ')} in .cursor/rules/`);
  }
}
