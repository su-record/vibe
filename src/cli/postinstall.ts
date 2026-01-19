#!/usr/bin/env node
/**
 * postinstall 스크립트
 * npm install -g @su-record/vibe 시 전역 설정 폴더 생성
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 전역 vibe 설정 디렉토리 경로
 */
function getVibeConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
  }
  return path.join(os.homedir(), '.config', 'vibe');
}

/**
 * 디렉토리 생성 (재귀)
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 디렉토리 복사 (재귀)
 */
function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 디렉토리 삭제 (재귀)
 */
function removeDirRecursive(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * postinstall 메인 함수
 */
function main(): void {
  try {
    const globalVibeDir = getVibeConfigDir();
    const nodeModulesDir = path.join(globalVibeDir, 'node_modules');
    const vibePackageDir = path.join(nodeModulesDir, '@su-record', 'vibe');
    const packageRoot = path.resolve(__dirname, '..', '..');

    // 1. 전역 vibe 디렉토리 구조 생성
    ensureDir(globalVibeDir);
    ensureDir(nodeModulesDir);
    ensureDir(path.join(nodeModulesDir, '@su-record'));

    // 2. 패키지 복사
    if (fs.existsSync(vibePackageDir)) {
      removeDirRecursive(vibePackageDir);
    }
    if (fs.existsSync(packageRoot)) {
      copyDirRecursive(packageRoot, vibePackageDir);
    }

    // 3. 훅 스크립트 복사 (%APPDATA%/vibe/hooks/scripts/)
    const hooksSource = path.join(packageRoot, 'hooks', 'scripts');
    const hooksTarget = path.join(globalVibeDir, 'hooks', 'scripts');
    if (fs.existsSync(hooksSource)) {
      ensureDir(path.join(globalVibeDir, 'hooks'));
      if (fs.existsSync(hooksTarget)) {
        removeDirRecursive(hooksTarget);
      }
      copyDirRecursive(hooksSource, hooksTarget);
    }

    // 4. ~/.claude/ 전역 assets 설치 (commands, agents, skills)
    const globalClaudeDir = path.join(os.homedir(), '.claude');
    ensureDir(globalClaudeDir);

    // commands 복사
    const commandsSource = path.join(packageRoot, 'commands');
    const globalCommandsDir = path.join(globalClaudeDir, 'commands');
    if (fs.existsSync(commandsSource)) {
      ensureDir(globalCommandsDir);
      copyDirRecursive(commandsSource, globalCommandsDir);
    }

    // agents 복사
    const agentsSource = path.join(packageRoot, 'agents');
    const globalAgentsDir = path.join(globalClaudeDir, 'agents');
    if (fs.existsSync(agentsSource)) {
      ensureDir(globalAgentsDir);
      copyDirRecursive(agentsSource, globalAgentsDir);
    }

    // skills 복사
    const skillsSource = path.join(packageRoot, 'skills');
    const globalSkillsDir = path.join(globalClaudeDir, 'skills');
    if (fs.existsSync(skillsSource)) {
      ensureDir(globalSkillsDir);
      copyDirRecursive(skillsSource, globalSkillsDir);
    }

    // 5. ~/.claude/vibe/ 전역 문서 설치 (rules, languages, templates)
    // 프로젝트별로 복사하지 않고 전역에서 참조
    const globalVibeAssetsDir = path.join(globalClaudeDir, 'vibe');
    ensureDir(globalVibeAssetsDir);

    // vibe/rules 복사
    const rulesSource = path.join(packageRoot, 'vibe', 'rules');
    const globalRulesDir = path.join(globalVibeAssetsDir, 'rules');
    if (fs.existsSync(rulesSource)) {
      if (fs.existsSync(globalRulesDir)) {
        removeDirRecursive(globalRulesDir);
      }
      copyDirRecursive(rulesSource, globalRulesDir);
    }

    // vibe/templates 복사
    const templatesSource = path.join(packageRoot, 'vibe', 'templates');
    const globalTemplatesDir = path.join(globalVibeAssetsDir, 'templates');
    if (fs.existsSync(templatesSource)) {
      if (fs.existsSync(globalTemplatesDir)) {
        removeDirRecursive(globalTemplatesDir);
      }
      copyDirRecursive(templatesSource, globalTemplatesDir);
    }

    // languages 복사
    const languagesSource = path.join(packageRoot, 'languages');
    const globalLanguagesDir = path.join(globalVibeAssetsDir, 'languages');
    if (fs.existsSync(languagesSource)) {
      if (fs.existsSync(globalLanguagesDir)) {
        removeDirRecursive(globalLanguagesDir);
      }
      copyDirRecursive(languagesSource, globalLanguagesDir);
    }

    // 6. hooks는 프로젝트 레벨에서 관리 (vibe init/update에서 처리)
    // 전역 설정에는 훅을 등록하지 않음 - 프로젝트별 .claude/settings.local.json 사용

    console.log(`✅ vibe global setup complete: ${globalVibeDir}`);
  } catch (error) {
    // postinstall 실패해도 설치는 계속 진행
    console.warn('⚠️  vibe postinstall warning:', (error as Error).message);
  }
}

main();
