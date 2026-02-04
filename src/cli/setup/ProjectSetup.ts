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
import { STACK_TO_LANGUAGE_FILE } from '../postinstall.js';
import { detectOsLanguage, getLanguageInstruction } from './LanguageDetector.js';
import { getCoreConfigDir } from './GlobalInstaller.js';

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
  const templatePath = path.join(__dirname, '../../../core/templates/constitution-template.md');
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
// VIBE 섹션 마커
const CORE_START_MARKER = '# VIBE';
const CORE_END_MARKER = '<!-- VIBE:END -->';

export function updateClaudeMd(
  projectRoot: string,
  detectedStacks: TechStack[],
  isUpdate = false
): void {
  const coreClaudeMd = path.join(__dirname, '../../../CLAUDE.md');
  const projectClaudeMd = path.join(projectRoot, 'CLAUDE.md');

  if (!fs.existsSync(coreClaudeMd)) return;

  let coreContent = fs.readFileSync(coreClaudeMd, 'utf-8').replace(/\r\n/g, '\n');

  // OS 언어 감지하여 응답 언어 설정 추가/교체
  const osLanguage = detectOsLanguage();
  const languageInstruction = getLanguageInstruction(osLanguage);

  // 기존 Response Language 섹션 제거 (중복 방지)
  coreContent = coreContent.replace(
    /\n*## Response Language\n+\*\*IMPORTANT: Always respond in (?:English|Korean \(한국어\)) unless the user explicitly requests otherwise\.\*\*/g,
    ''
  );

  // # VIBE 헤더 바로 다음에 언어 설정 추가
  coreContent = coreContent.replace(
    '# VIBE\n\nSPEC-driven AI Coding Framework (Claude Code Exclusive)',
    '# VIBE\n\nSPEC-driven AI Coding Framework (Claude Code Exclusive)' + languageInstruction
  );

  // 감지된 기술 스택에 따라 언어별 규칙 추가
  const languageRules = getLanguageRulesContent(detectedStacks);
  if (languageRules) {
    coreContent = coreContent.replace(
      '### Error Handling Required',
      languageRules + '\n\n### Error Handling Required'
    );
  }

  if (fs.existsSync(projectClaudeMd)) {
    const existingContent = fs.readFileSync(projectClaudeMd, 'utf-8');

    // VIBE 섹션 교체 (마커 기반)
    const coreStartIdx = existingContent.indexOf(CORE_START_MARKER);
    const coreEndIdx = existingContent.indexOf(CORE_END_MARKER);

    if (coreStartIdx !== -1 && coreEndIdx !== -1) {
      // 마커 기반 정확한 교체
      // 이전 버전에서 누적된 --- 구분선 정리
      const beforeCore = existingContent.substring(0, coreStartIdx).trimEnd().replace(/(\n---\s*)+$/g, '').trimEnd();
      let afterCore = existingContent.substring(coreEndIdx + CORE_END_MARKER.length).trimStart();

      // afterCore가 CORE 중복 내용인지 확인
      // 사용자 커스텀 섹션은 보통 # 으로 시작하는 새로운 헤더로 시작함 (## 가 아닌 # 레벨)
      // --- 구분자와 빈 줄을 모두 제거하고 실제 내용 확인
      const cleanedAfterCore = afterCore.replace(/^(-{3,}\s*\n*)+/g, '').trimStart();

      // CORE 관련 키워드가 있으면 중복으로 판단하여 버림
      const isCoreContent = cleanedAfterCore.startsWith('# CORE') ||
                           cleanedAfterCore.startsWith('## Rule Title') ||
                           cleanedAfterCore.startsWith('## Response Language') ||
                           cleanedAfterCore.startsWith('## Code Quality') ||
                           cleanedAfterCore.startsWith('title:') ||
                           cleanedAfterCore.includes('SPEC-driven AI Coding Framework') ||
                           cleanedAfterCore.includes('/core.spec') ||
                           cleanedAfterCore.includes('ULTRAWORK');

      if (isCoreContent) {
        afterCore = '';  // 중복 CORE 내용 - 버림
      }

      let newContent = '';
      if (beforeCore) {
        newContent = beforeCore + '\n\n' + coreContent;
      } else {
        newContent = coreContent;
      }
      if (afterCore) {
        newContent += '\n\n' + afterCore;
      }
      fs.writeFileSync(projectClaudeMd, newContent);
    } else if (coreStartIdx !== -1) {
      // 구버전: # VIBE는 있지만 END 마커 없음
      // VIBE 앞의 사용자 섹션만 보존하고, VIBE 이후는 전체 교체
      // (VIBE 뒤의 내용은 대부분 누적된 중복 VIBE 섹션임)
      const beforeCore = existingContent.substring(0, coreStartIdx).trimEnd();
      const newContent = (beforeCore ? beforeCore + '\n\n' : '') + coreContent;
      fs.writeFileSync(projectClaudeMd, newContent);
    } else if (!existingContent.includes('/core.spec')) {
      // VIBE 섹션 없음 - 추가
      const mergedContent = existingContent.trim() + '\n\n' + coreContent;
      fs.writeFileSync(projectClaudeMd, mergedContent);
    }
    // else: 이미 VIBE 관련 내용이 있지만 마커가 없는 경우 - 건드리지 않음
  } else {
    fs.writeFileSync(projectClaudeMd, coreContent);
  }
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
    } catch {
      // 파싱 실패시 새로 생성
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

  // 레거시 mcp 폴더 제외 제거
  if (gitignore.includes('.claude/core/mcp/')) {
    gitignore = gitignore.replace(/# core MCP\n\.claude\/core\/mcp\/\n?/g, '');
    gitignore = gitignore.replace(/\.claude\/core\/mcp\/\n?/g, '');
    modified = true;
  }

  // 레거시 node_modules 제외 제거
  if (gitignore.includes('.claude/core/node_modules/')) {
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
  const globalCoreDir = '~/.claude/core';

  const rules = [
    `${globalCoreDir}/rules/core/quick-start.md`,
    `${globalCoreDir}/rules/core/development-philosophy.md`,
    `${globalCoreDir}/rules/core/communication-guide.md`,
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

// 이전 버전에서 생성된 레거시 파일명 (정리 대상)
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
      try { fs.unlinkSync(legacyPath); } catch { /* 무시 */ }
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
        } catch {
          // 권한 문제 등 무시
        }
      } else if (exists) {
        // 현재 프로젝트에 해당하지 않는 언어 룰 제거
        try {
          fs.unlinkSync(destPath);
          removed++;
        } catch {
          // 무시
        }
      }
    } else if (!exists) {
      // 공통 룰: 없을 때만 복사 (사용자 수정 보존)
      try {
        fs.copyFileSync(srcPath, destPath);
        installed++;
      } catch {
        // 권한 문제 등 무시
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
