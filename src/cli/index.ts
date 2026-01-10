#!/usr/bin/env node

/**
 * vibe CLI (TypeScript version 2.0)
 * SPEC-driven AI coding framework (Claude Code 전용)
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Types
// ============================================================================

interface CliOptions {
  silent: boolean;
}

interface LLMAuthStatus {
  type: 'oauth' | 'apikey';
  email?: string;
  valid: boolean;
}

interface LLMStatusMap {
  gpt: LLMAuthStatus | null;
  gemini: LLMAuthStatus | null;
}

interface DetectedStack {
  type: string;
  path: string;
}

interface StackDetails {
  databases: string[];
  stateManagement: string[];
  hosting: string[];
  cicd: string[];
}

interface DetectionResult {
  stacks: DetectedStack[];
  details: StackDetails;
}

interface ExternalLLMConfig {
  name: string;
  role: string;
  description: string;
  package: string;
  envKey: string;
}

interface VibeConfig {
  language?: string;
  quality?: { strict: boolean; autoVerify: boolean };
  stacks?: DetectedStack[];
  details?: StackDetails;
  models?: {
    gpt?: { enabled: boolean; authType?: string; email?: string; role?: string; description?: string };
    gemini?: { enabled: boolean; authType?: string; email?: string; role?: string; description?: string };
  };
}

interface OAuthTokens {
  email: string;
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  expires: number;
  accountId?: string;
  projectId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

const options: CliOptions = {
  silent: args.includes('--silent') || args.includes('-s')
};

const positionalArgs = args.filter(arg => !arg.startsWith('-'));

/**
 * 버전 비교 (semver)
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

const DEFAULT_MCPS = [
  { name: 'vibe', type: 'node', local: true },
  { name: 'context7', type: 'npx', package: '@upstash/context7-mcp@latest' }
];

const EXTERNAL_LLMS: Record<string, ExternalLLMConfig> = {
  gpt: {
    name: 'vibe-gpt',
    role: 'architecture',
    description: '아키텍처/디버깅 (GPT 5.2)',
    package: '@anthropics/openai-mcp',
    envKey: 'OPENAI_API_KEY'
  },
  gemini: {
    name: 'vibe-gemini',
    role: 'ui-ux',
    description: 'UI/UX 설계 (Gemini 3)',
    package: '@anthropics/gemini-mcp',
    envKey: 'GOOGLE_API_KEY'
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

function log(message: string): void {
  if (!options.silent) {
    console.log(message);
  }
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirContents(sourceDir: string, targetDir: string): void {
  if (fs.existsSync(sourceDir)) {
    fs.readdirSync(sourceDir).forEach(file => {
      fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
    });
  }
}

function copyDirRecursive(sourceDir: string, targetDir: string): void {
  if (!fs.existsSync(sourceDir)) return;

  ensureDir(targetDir);

  fs.readdirSync(sourceDir).forEach(item => {
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);

    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

function removeDirRecursive(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;

  fs.readdirSync(dirPath).forEach(item => {
    const itemPath = path.join(dirPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      removeDirRecursive(itemPath);
    } else {
      fs.unlinkSync(itemPath);
    }
  });
  fs.rmdirSync(dirPath);
}

function getPackageJson(): { version: string } {
  const pkgPath = path.join(__dirname, '../../package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

// ============================================================================
// LLM Auth Status
// ============================================================================

function getLLMAuthStatus(): LLMStatusMap {
  const status: LLMStatusMap = { gpt: null, gemini: null };

  // GPT 상태 확인
  try {
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
    if (fs.existsSync(gptStoragePath)) {
      const gptStorage = require(gptStoragePath);
      const account = gptStorage.getActiveAccount();
      if (account) {
        const isExpired = gptStorage.isTokenExpired(account);
        status.gpt = {
          type: 'oauth',
          email: account.email,
          valid: !isExpired
        };
      }
    }
  } catch (e) {}

  // GPT API 키 확인 (프로젝트 config)
  if (!status.gpt) {
    try {
      const configPath = path.join(process.cwd(), '.vibe', 'config.json');
      if (fs.existsSync(configPath)) {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gpt?.enabled) {
          status.gpt = { type: 'apikey', valid: true };
        }
      }
    } catch (e) {}
  }

  // Gemini 상태 확인
  try {
    const tokenPath = path.join(os.homedir(), '.config', 'vibe', 'gemini-auth.json');
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      if (tokenData.accounts && tokenData.accounts.length > 0) {
        const activeAccount = tokenData.accounts.find((a: any) => a.active) || tokenData.accounts[0];
        const isExpired = activeAccount.expires && Date.now() > activeAccount.expires;
        status.gemini = {
          type: 'oauth',
          email: activeAccount.email || 'default',
          valid: !isExpired || !!activeAccount.refreshToken
        };
      }
    }
  } catch (e) {}

  // Gemini API 키 확인 (프로젝트 config)
  if (!status.gemini) {
    try {
      const configPath = path.join(process.cwd(), '.vibe', 'config.json');
      if (fs.existsSync(configPath)) {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gemini?.enabled) {
          status.gemini = { type: 'apikey', valid: true };
        }
      }
    } catch (e) {}
  }

  return status;
}

function formatLLMStatus(): string {
  const status = getLLMAuthStatus();
  const lines: string[] = [];

  lines.push('외부 LLM:');

  // GPT 상태
  if (status.gpt) {
    if (status.gpt.type === 'oauth') {
      const icon = status.gpt.valid ? '✓' : '⚠';
      lines.push(`  GPT: ${icon} OAuth 인증됨 (${status.gpt.email})`);
    } else {
      lines.push('  GPT: ✓ API 키 설정됨');
    }
  } else {
    lines.push('  GPT: ✗ 미설정 (vibe gpt --auth 또는 vibe gpt <api-key>)');
  }

  // Gemini 상태
  if (status.gemini) {
    if (status.gemini.type === 'oauth') {
      const icon = status.gemini.valid ? '✓' : '⚠';
      lines.push(`  Gemini: ${icon} OAuth 인증됨 (${status.gemini.email})`);
    } else {
      lines.push('  Gemini: ✓ API 키 설정됨');
    }
  } else {
    lines.push('  Gemini: ✗ 미설정 (vibe gemini --auth 또는 vibe gemini <api-key>)');
  }

  return lines.join('\n');
}

// ============================================================================
// Tech Stack Detection
// ============================================================================

function detectTechStacks(projectRoot: string): DetectionResult {
  const stacks: DetectedStack[] = [];
  const details: StackDetails = { databases: [], stateManagement: [], hosting: [], cicd: [] };

  const detectInDir = (dir: string, prefix = ''): DetectedStack[] => {
    const detected: DetectedStack[] = [];

    // Node.js / TypeScript
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // 프레임워크 감지
        if (deps['next']) detected.push({ type: 'typescript-nextjs', path: prefix });
        else if (deps['react-native']) detected.push({ type: 'typescript-react-native', path: prefix });
        else if (deps['react']) detected.push({ type: 'typescript-react', path: prefix });
        else if (deps['vue']) detected.push({ type: 'typescript-vue', path: prefix });
        else if (deps['express'] || deps['fastify'] || deps['koa']) detected.push({ type: 'typescript-node', path: prefix });
        else if (pkg.name) detected.push({ type: 'typescript-node', path: prefix });

        // DB 감지
        if (deps['pg'] || deps['postgres'] || deps['@prisma/client']) details.databases.push('PostgreSQL');
        if (deps['mysql'] || deps['mysql2']) details.databases.push('MySQL');
        if (deps['mongodb'] || deps['mongoose']) details.databases.push('MongoDB');
        if (deps['redis'] || deps['ioredis']) details.databases.push('Redis');
        if (deps['sqlite3'] || deps['better-sqlite3']) details.databases.push('SQLite');
        if (deps['typeorm']) details.databases.push('TypeORM');
        if (deps['prisma'] || deps['@prisma/client']) details.databases.push('Prisma');
        if (deps['drizzle-orm']) details.databases.push('Drizzle');
        if (deps['sequelize']) details.databases.push('Sequelize');

        // 상태관리 감지
        if (deps['redux'] || deps['@reduxjs/toolkit']) details.stateManagement.push('Redux');
        if (deps['zustand']) details.stateManagement.push('Zustand');
        if (deps['jotai']) details.stateManagement.push('Jotai');
        if (deps['recoil']) details.stateManagement.push('Recoil');
        if (deps['mobx']) details.stateManagement.push('MobX');
        if (deps['@tanstack/react-query'] || deps['react-query']) details.stateManagement.push('React Query');
        if (deps['swr']) details.stateManagement.push('SWR');
        if (deps['pinia']) details.stateManagement.push('Pinia');
        if (deps['vuex']) details.stateManagement.push('Vuex');
      } catch (e) {}
    }

    // Python
    if (fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      try {
        const content = fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf-8');
        if (content.includes('fastapi')) detected.push({ type: 'python-fastapi', path: prefix });
        else if (content.includes('django')) detected.push({ type: 'python-django', path: prefix });
        else detected.push({ type: 'python', path: prefix });

        if (content.includes('psycopg') || content.includes('asyncpg')) details.databases.push('PostgreSQL');
        if (content.includes('pymongo')) details.databases.push('MongoDB');
        if (content.includes('sqlalchemy')) details.databases.push('SQLAlchemy');
        if (content.includes('prisma')) details.databases.push('Prisma');
      } catch (e) {}
    } else if (fs.existsSync(path.join(dir, 'requirements.txt'))) {
      try {
        const content = fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf-8');
        if (content.includes('fastapi')) detected.push({ type: 'python-fastapi', path: prefix });
        else if (content.includes('django')) detected.push({ type: 'python-django', path: prefix });
        else detected.push({ type: 'python', path: prefix });

        if (content.includes('psycopg') || content.includes('asyncpg')) details.databases.push('PostgreSQL');
        if (content.includes('pymongo')) details.databases.push('MongoDB');
        if (content.includes('sqlalchemy')) details.databases.push('SQLAlchemy');
      } catch (e) {}
    }

    // Flutter / Dart
    if (fs.existsSync(path.join(dir, 'pubspec.yaml'))) {
      detected.push({ type: 'dart-flutter', path: prefix });
      try {
        const content = fs.readFileSync(path.join(dir, 'pubspec.yaml'), 'utf-8');
        if (content.includes('flutter_riverpod') || content.includes('riverpod')) details.stateManagement.push('Riverpod');
        else if (content.includes('provider')) details.stateManagement.push('Provider');
        if (content.includes('bloc')) details.stateManagement.push('BLoC');
        if (content.includes('getx') || content.includes('get:')) details.stateManagement.push('GetX');
      } catch (e) {}
    }

    // Go
    if (fs.existsSync(path.join(dir, 'go.mod'))) {
      detected.push({ type: 'go', path: prefix });
      try {
        const content = fs.readFileSync(path.join(dir, 'go.mod'), 'utf-8');
        if (content.includes('pgx') || content.includes('pq')) details.databases.push('PostgreSQL');
        if (content.includes('go-redis')) details.databases.push('Redis');
        if (content.includes('mongo-driver')) details.databases.push('MongoDB');
      } catch (e) {}
    }

    // Rust
    if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
      detected.push({ type: 'rust', path: prefix });
      try {
        const content = fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf-8');
        if (content.includes('sqlx') || content.includes('diesel')) details.databases.push('PostgreSQL');
        if (content.includes('mongodb')) details.databases.push('MongoDB');
      } catch (e) {}
    }

    // Java / Kotlin
    if (fs.existsSync(path.join(dir, 'build.gradle')) || fs.existsSync(path.join(dir, 'build.gradle.kts'))) {
      try {
        const gradleFile = fs.existsSync(path.join(dir, 'build.gradle.kts'))
          ? path.join(dir, 'build.gradle.kts')
          : path.join(dir, 'build.gradle');
        const content = fs.readFileSync(gradleFile, 'utf-8');
        if (content.includes('com.android')) detected.push({ type: 'kotlin-android', path: prefix });
        else if (content.includes('kotlin')) detected.push({ type: 'kotlin', path: prefix });
        else if (content.includes('spring')) detected.push({ type: 'java-spring', path: prefix });
        else detected.push({ type: 'java', path: prefix });

        if (content.includes('postgresql')) details.databases.push('PostgreSQL');
        if (content.includes('mysql')) details.databases.push('MySQL');
        if (content.includes('jpa') || content.includes('hibernate')) details.databases.push('JPA/Hibernate');
      } catch (e) {}
    } else if (fs.existsSync(path.join(dir, 'pom.xml'))) {
      try {
        const content = fs.readFileSync(path.join(dir, 'pom.xml'), 'utf-8');
        if (content.includes('spring')) detected.push({ type: 'java-spring', path: prefix });
        else detected.push({ type: 'java', path: prefix });

        if (content.includes('postgresql')) details.databases.push('PostgreSQL');
        if (content.includes('mysql')) details.databases.push('MySQL');
      } catch (e) {}
    }

    // Swift / iOS
    if (fs.existsSync(path.join(dir, 'Package.swift')) ||
        fs.readdirSync(dir).some(f => f.endsWith('.xcodeproj') || f.endsWith('.xcworkspace'))) {
      detected.push({ type: 'swift-ios', path: prefix });
    }

    return detected;
  };

  // CI/CD 감지
  if (fs.existsSync(path.join(projectRoot, '.github', 'workflows'))) {
    details.cicd.push('GitHub Actions');
  }
  if (fs.existsSync(path.join(projectRoot, '.gitlab-ci.yml'))) {
    details.cicd.push('GitLab CI');
  }
  if (fs.existsSync(path.join(projectRoot, 'Jenkinsfile'))) {
    details.cicd.push('Jenkins');
  }
  if (fs.existsSync(path.join(projectRoot, '.circleci'))) {
    details.cicd.push('CircleCI');
  }

  // Hosting 감지
  if (fs.existsSync(path.join(projectRoot, 'vercel.json')) ||
      fs.existsSync(path.join(projectRoot, '.vercel'))) {
    details.hosting.push('Vercel');
  }
  if (fs.existsSync(path.join(projectRoot, 'netlify.toml'))) {
    details.hosting.push('Netlify');
  }
  if (fs.existsSync(path.join(projectRoot, 'app.yaml')) ||
      fs.existsSync(path.join(projectRoot, 'cloudbuild.yaml'))) {
    details.hosting.push('Google Cloud');
  }
  if (fs.existsSync(path.join(projectRoot, 'Dockerfile')) ||
      fs.existsSync(path.join(projectRoot, 'docker-compose.yml'))) {
    details.hosting.push('Docker');
  }
  if (fs.existsSync(path.join(projectRoot, 'fly.toml'))) {
    details.hosting.push('Fly.io');
  }
  if (fs.existsSync(path.join(projectRoot, 'railway.json'))) {
    details.hosting.push('Railway');
  }

  // 루트 디렉토리 검사
  stacks.push(...detectInDir(projectRoot));

  // 1레벨 하위 폴더 검사
  const subDirs = ['backend', 'frontend', 'server', 'client', 'api', 'web', 'mobile', 'app', 'packages', 'apps'];
  for (const subDir of subDirs) {
    const subPath = path.join(projectRoot, subDir);
    if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
      stacks.push(...detectInDir(subPath, subDir));
    }
  }

  // packages/* 또는 apps/* 내부 검사 (monorepo)
  for (const monoDir of ['packages', 'apps']) {
    const monoPath = path.join(projectRoot, monoDir);
    if (fs.existsSync(monoPath) && fs.statSync(monoPath).isDirectory()) {
      const subPackages = fs.readdirSync(monoPath).filter(f => {
        const fullPath = path.join(monoPath, f);
        return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
      });
      for (const pkg of subPackages) {
        stacks.push(...detectInDir(path.join(monoPath, pkg), `${monoDir}/${pkg}`));
      }
    }
  }

  // 중복 제거
  details.databases = [...new Set(details.databases)];
  details.stateManagement = [...new Set(details.stateManagement)];
  details.hosting = [...new Set(details.hosting)];
  details.cicd = [...new Set(details.cicd)];

  return { stacks, details };
}

// ============================================================================
// Collaborator Setup
// ============================================================================

function setupCollaboratorAutoInstall(projectRoot: string): void {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const vibeDir = path.join(projectRoot, '.vibe');
  const vibeVersion = getPackageJson().version;

  // 1. Node.js 프로젝트: package.json 정리
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      let modified = false;

      // 기존 devDependencies에서 @su-record/vibe 제거
      if (pkg.devDependencies?.['@su-record/vibe']) {
        delete pkg.devDependencies['@su-record/vibe'];
        modified = true;
      }

      // 기존 postinstall/prepare에서 vibe update 제거
      if (pkg.scripts) {
        const oldPatterns = [
          /\s*&&\s*npx @su-record\/vibe update[^&|;]*/g,
          /npx @su-record\/vibe update[^&|;]*\s*&&\s*/g,
          /npx @su-record\/vibe update[^&|;]*/g,
          /\s*&&\s*node_modules\/\.bin\/vibe update[^&|;]*/g,
          /node_modules\/\.bin\/vibe update[^&|;]*\s*&&\s*/g,
          /node_modules\/\.bin\/vibe update[^&|;]*/g
        ];

        ['postinstall', 'prepare'].forEach(script => {
          if (pkg.scripts[script]?.includes('vibe update')) {
            let cleaned = pkg.scripts[script];
            oldPatterns.forEach(p => { cleaned = cleaned.replace(p, ''); });
            cleaned = cleaned.trim();
            if (cleaned) {
              pkg.scripts[script] = cleaned;
            } else {
              delete pkg.scripts[script];
            }
            modified = true;
          }
        });
      }

      if (modified) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
        log('   ✅ package.json 정리 완료 (레거시 vibe 설정 제거)\n');
      }
    } catch (e: any) {
      log('   ⚠️  package.json 수정 실패: ' + e.message + '\n');
    }
  }

  // 2. .vibe/setup.sh 생성
  const setupShPath = path.join(vibeDir, 'setup.sh');
  if (!fs.existsSync(setupShPath)) {
    const setupScript = `#!/bin/bash
# Vibe 협업자 자동 설치 스크립트
# 사용법: ./.vibe/setup.sh

set -e

echo "🔧 Vibe 설치 확인 중..."

# npm/npx 확인
if ! command -v npx &> /dev/null; then
    echo "❌ Node.js/npm이 설치되어 있지 않습니다."
    echo "   https://nodejs.org 에서 설치해주세요."
    exit 1
fi

# vibe 설치 확인 및 업데이트
if command -v vibe &> /dev/null; then
    echo "✅ Vibe가 이미 설치되어 있습니다."
    vibe update --silent
    echo "✅ Vibe 업데이트 완료!"
else
    echo "📦 Vibe 설치 중..."
    npm install -g @su-record/vibe
    vibe update --silent
    echo "✅ Vibe 설치 및 설정 완료!"
fi

echo ""
echo "다음 명령어로 시작하세요:"
echo "  /vibe.spec \\"기능명\\"    SPEC 작성"
echo "  /vibe.run \\"기능명\\"     구현 실행"
`;
    fs.writeFileSync(setupShPath, setupScript);
    fs.chmodSync(setupShPath, '755');
    log('   ✅ 협업자 설치 스크립트 생성 (.vibe/setup.sh)\n');
  }

  // 3. README.md에 협업자 안내 추가
  const readmePath = path.join(projectRoot, 'README.md');
  const vibeSetupSection = `
## Vibe Setup (AI Coding)

이 프로젝트는 [Vibe](https://github.com/su-record/vibe) AI 코딩 프레임워크를 사용합니다.

### 협업자 설치

\`\`\`bash
# 전역 설치 (권장)
npm install -g @su-record/vibe
vibe update

# 또는 setup 스크립트 실행
./.vibe/setup.sh
\`\`\`

### 사용법

Claude Code에서 슬래시 커맨드 사용:
- \`/vibe.spec "기능명"\` - SPEC 문서 작성
- \`/vibe.run "기능명"\` - 구현 실행
`;

  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf-8');
    if (!readme.includes('## Vibe Setup')) {
      fs.appendFileSync(readmePath, vibeSetupSection);
      log('   ✅ README.md에 협업자 안내 추가\n');
    }
  } else {
    fs.writeFileSync(readmePath, `# Project\n${vibeSetupSection}`);
    log('   ✅ README.md 생성 (협업자 안내 포함)\n');
  }
}

// ============================================================================
// Stack Name Mapping
// ============================================================================

const STACK_NAMES: Record<string, { lang: string; framework: string }> = {
  'python-fastapi': { lang: 'Python 3.11+', framework: 'FastAPI' },
  'python-django': { lang: 'Python 3.11+', framework: 'Django' },
  'python': { lang: 'Python 3.11+', framework: '-' },
  'typescript-node': { lang: 'TypeScript/Node.js', framework: 'Express/Fastify' },
  'typescript-nextjs': { lang: 'TypeScript', framework: 'Next.js' },
  'typescript-react': { lang: 'TypeScript', framework: 'React' },
  'typescript-vue': { lang: 'TypeScript', framework: 'Vue.js' },
  'typescript-react-native': { lang: 'TypeScript', framework: 'React Native' },
  'dart-flutter': { lang: 'Dart', framework: 'Flutter' },
  'go': { lang: 'Go', framework: '-' },
  'rust': { lang: 'Rust', framework: '-' },
  'java-spring': { lang: 'Java 17+', framework: 'Spring Boot' },
  'kotlin-android': { lang: 'Kotlin', framework: 'Android' },
  'swift-ios': { lang: 'Swift', framework: 'iOS/SwiftUI' }
};

// ============================================================================
// Main Commands
// ============================================================================

async function init(projectName?: string): Promise<void> {
  try {
    let projectRoot = process.cwd();
    let isNewProject = false;

    if (projectName) {
      projectRoot = path.join(process.cwd(), projectName);

      if (fs.existsSync(projectRoot)) {
        log(`❌ 폴더가 이미 존재합니다: ${projectName}/`);
        return;
      }

      log(`📁 새 프로젝트 생성: ${projectName}/\n`);
      fs.mkdirSync(projectRoot, { recursive: true });
      isNewProject = true;
    }

    const vibeDir = path.join(projectRoot, '.vibe');
    if (fs.existsSync(vibeDir)) {
      log('❌ .vibe/ 폴더가 이미 존재합니다.');
      return;
    }

    ensureDir(vibeDir);

    // MCP 서버 등록
    log('🔧 Claude Code MCP 서버 등록 중 (전역)...\n');

    const geminiMcpPath = path.join(__dirname, '../lib/gemini-mcp.js');
    const gptMcpPath = path.join(__dirname, '../lib/gpt-mcp.js');

    // 0. 기존 hi-ai/vibe MCP 제거 (마이그레이션 - 내장 도구로 전환)
    try {
      execSync('claude mcp remove vibe', { stdio: 'pipe' });
      execSync('claude mcp remove vibe -s user', { stdio: 'pipe' });
    } catch (e) {
      // 이미 없으면 무시
    }

    // 1. vibe-gemini MCP
    if (fs.existsSync(geminiMcpPath)) {
      try {
        execSync(`claude mcp add vibe-gemini -s user node "${geminiMcpPath}"`, { stdio: 'pipe' });
        log('   ✅ vibe-gemini MCP 등록 완료 (전역)\n');
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          log('   ℹ️  vibe-gemini MCP 이미 등록됨\n');
        }
      }
    }

    // 3. vibe-gpt MCP
    if (fs.existsSync(gptMcpPath)) {
      try {
        execSync(`claude mcp add vibe-gpt -s user node "${gptMcpPath}"`, { stdio: 'pipe' });
        log('   ✅ vibe-gpt MCP 등록 완료 (전역)\n');
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          log('   ℹ️  vibe-gpt MCP 이미 등록됨\n');
        }
      }
    }

    // 4. Context7 MCP
    try {
      execSync('claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest', { stdio: 'pipe' });
      log('   ✅ Context7 MCP 등록 완료 (라이브러리 문서 검색)\n');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        log('   ℹ️  Context7 MCP 이미 등록됨\n');
      } else {
        log('   ⚠️  Context7 MCP 수동 등록 필요\n');
      }
    }

    // .vibe 폴더 구조 생성
    ['specs', 'features'].forEach(dir => {
      ensureDir(path.join(vibeDir, dir));
    });

    // 기존 .vibe/mcp/ 폴더 정리
    const oldMcpDir = path.join(vibeDir, 'mcp');
    if (fs.existsSync(oldMcpDir)) {
      log('   🧹 기존 .vibe/mcp/ 폴더 정리 중...\n');
      try {
        removeDirRecursive(oldMcpDir);
        log('   ✅ .vibe/mcp/ 폴더 삭제 완료\n');
      } catch (e) {
        log('   ⚠️  .vibe/mcp/ 폴더 수동 삭제 필요\n');
      }
    }

    // .gitignore 업데이트
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const mcpIgnore = '.vibe/mcp/';
    if (fs.existsSync(gitignorePath)) {
      let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignore.includes(mcpIgnore)) {
        gitignore += `\n# vibe MCP\n${mcpIgnore}\n`;
        fs.writeFileSync(gitignorePath, gitignore);
      }
    } else {
      fs.writeFileSync(gitignorePath, `# vibe MCP\n${mcpIgnore}\n`);
    }

    // .claude/commands 복사
    const claudeDir = path.join(projectRoot, '.claude');
    const commandsDir = path.join(claudeDir, 'commands');
    ensureDir(claudeDir);
    ensureDir(commandsDir);

    const sourceDir = path.join(__dirname, '../../.claude/commands');
    copyDirContents(sourceDir, commandsDir);
    log('   ✅ 슬래시 커맨드 설치 완료 (7개)\n');

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);
    if (detectedStacks.length > 0) {
      log(`   🔍 감지된 기술 스택:\n`);
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
    const templatePath = path.join(__dirname, '../../templates/constitution-template.md');
    const constitutionPath = path.join(vibeDir, 'constitution.md');
    if (fs.existsSync(templatePath)) {
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

    // config.json 생성
    const config: VibeConfig = {
      language: 'ko',
      quality: { strict: true, autoVerify: true },
      stacks: detectedStacks,
      details: stackDetails
    };
    fs.writeFileSync(path.join(vibeDir, 'config.json'), JSON.stringify(config, null, 2));

    // CLAUDE.md 병합
    const vibeClaudeMd = path.join(__dirname, '../../CLAUDE.md');
    const projectClaudeMd = path.join(projectRoot, 'CLAUDE.md');

    if (fs.existsSync(projectClaudeMd)) {
      const existingContent = fs.readFileSync(projectClaudeMd, 'utf-8');
      const vibeContent = fs.readFileSync(vibeClaudeMd, 'utf-8');

      if (!existingContent.includes('/vibe.spec')) {
        const mergedContent = existingContent.trim() + '\n\n---\n\n' + vibeContent;
        fs.writeFileSync(projectClaudeMd, mergedContent);
        log('   ✅ CLAUDE.md에 vibe 섹션 추가\n');
      } else {
        log('   ℹ️  CLAUDE.md에 vibe 섹션 이미 존재\n');
      }
    } else {
      fs.copyFileSync(vibeClaudeMd, projectClaudeMd);
      log('   ✅ CLAUDE.md 생성\n');
    }

    // .vibe/rules/ 복사
    const rulesSource = path.join(__dirname, '../../.vibe/rules');
    const rulesTarget = path.join(vibeDir, 'rules');

    const coreDirs = ['core', 'quality', 'standards', 'tools'];
    coreDirs.forEach(dir => {
      const src = path.join(rulesSource, dir);
      const dst = path.join(rulesTarget, dir);
      if (fs.existsSync(src)) {
        copyDirRecursive(src, dst);
      }
    });

    const langSource = path.join(rulesSource, 'languages');
    const langTarget = path.join(rulesTarget, 'languages');
    ensureDir(langTarget);

    const detectedTypes = detectedStacks.map(s => s.type);
    if (fs.existsSync(langSource)) {
      const langFiles = fs.readdirSync(langSource);
      langFiles.forEach(file => {
        const langType = file.replace('.md', '');
        if (detectedTypes.includes(langType)) {
          fs.copyFileSync(path.join(langSource, file), path.join(langTarget, file));
        }
      });
    }

    log('   ✅ 코딩 규칙 설치 완료 (.vibe/rules/)\n');

    // .claude/agents/ 복사
    const agentsDir = path.join(claudeDir, 'agents');
    ensureDir(agentsDir);
    const agentsSourceDir = path.join(__dirname, '../../.claude/agents');
    copyDirContents(agentsSourceDir, agentsDir);
    log('   ✅ 서브에이전트 설치 완료 (.claude/agents/)\n');

    // .claude/settings.json 설정
    const settingsPath = path.join(claudeDir, 'settings.json');
    const hooksTemplate = path.join(__dirname, '../../templates/hooks-template.json');
    if (fs.existsSync(hooksTemplate)) {
      const vibeHooks = JSON.parse(fs.readFileSync(hooksTemplate, 'utf-8'));
      if (fs.existsSync(settingsPath)) {
        const existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        existingSettings.hooks = vibeHooks.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
        log('   ✅ Hooks 설정 업데이트 완료\n');
      } else {
        fs.copyFileSync(hooksTemplate, settingsPath);
        log('   ✅ Hooks 설정 설치 완료\n');
      }
    }

    // .gitignore에서 settings.local.json 제거
    if (fs.existsSync(gitignorePath)) {
      let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (gitignore.includes('settings.local.json')) {
        gitignore = gitignore.replace(/\.claude\/settings\.local\.json\n?/g, '');
        gitignore = gitignore.replace(/settings\.local\.json\n?/g, '');
        fs.writeFileSync(gitignorePath, gitignore);
        log('   ✅ .gitignore에서 settings.local.json 제거\n');
      }
    }

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 완료 메시지
    log(`
✅ vibe 초기화 완료!

${isNewProject ? `프로젝트 위치:
  ${projectRoot}/

` : ''}생성된 구조:
  CLAUDE.md                      # 프로젝트 컨텍스트
  .claude/
  ├── commands/                  # 슬래시 커맨드 (7개)
  ├── agents/                    # 서브에이전트 (simplifier)
  └── settings.json              # Hooks 설정 (저장소 공유)
  .vibe/
  ├── config.json                # 프로젝트 설정
  ├── constitution.md            # 프로젝트 원칙
  ├── setup.sh                   # 협업자 설치 스크립트
  ├── rules/                     # 코딩 규칙
  │   ├── core/                  # 핵심 원칙
  │   ├── quality/               # 품질 체크리스트
  │   └── languages/             # 언어별 규칙
  ├── specs/                     # SPEC 문서들
  └── features/                  # BDD Feature 파일들

내장 도구: ✓ (35+)
협업자 자동 설치: ✓

${formatLLMStatus()}

사용법:
  /vibe.spec "기능명"            SPEC 작성 (대화형)
  /vibe.run "기능명"             구현 실행
  /vibe.verify "기능명"          검증

다음 단계:
  ${isNewProject ? `cd ${projectName}\n  ` : ''}/vibe.spec "기능명" 으로 시작하세요!
    `);

  } catch (error: any) {
    console.error('❌ 초기화 실패:', error.message);
    process.exit(1);
  }
}

async function checkAndUpgradeVibe(): Promise<boolean> {
  const currentVersion = getPackageJson().version;

  try {
    const latestVersion = execSync('npm view @su-record/vibe version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    // 버전 비교: 실제로 새 버전인 경우에만 업그레이드
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    if (isNewer) {
      log(`   📦 새 버전 발견: v${currentVersion} → v${latestVersion}\n`);
      log('   ⬆️  vibe 업그레이드 중...\n');

      execSync('npm install -g @su-record/vibe@latest', {
        stdio: options.silent ? 'pipe' : 'inherit'
      });

      log('   ✅ vibe 업그레이드 완료!\n');

      log('   🔄 새 버전으로 업데이트 재실행...\n\n');
      execSync(`vibe update${options.silent ? ' --silent' : ''}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      return true;
    } else {
      log(`   ✅ 최신 버전 사용 중 (v${currentVersion})\n`);
      return false;
    }
  } catch (e) {
    log(`   ℹ️  버전 확인 스킵 (오프라인 또는 네트워크 오류)\n`);
    return false;
  }
}

async function update(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.vibe');
    const claudeDir = path.join(projectRoot, '.claude');

    // CI/프로덕션 환경에서는 스킵
    if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
      return;
    }

    if (!fs.existsSync(vibeDir)) {
      if (!options.silent) {
        console.log('❌ vibe 프로젝트가 아닙니다. 먼저 vibe init을 실행하세요.');
      }
      return;
    }

    log('🔄 vibe 업데이트 중...\n');

    // 최신 버전 확인
    if (!options.silent) {
      const wasUpgraded = await checkAndUpgradeVibe();
      if (wasUpgraded) return;
    }

    // 마이그레이션: .agent/rules/ → .vibe/rules/
    const oldRulesDir = path.join(projectRoot, '.agent/rules');
    const oldAgentDir = path.join(projectRoot, '.agent');
    if (fs.existsSync(oldRulesDir)) {
      log('   🔄 마이그레이션: .agent/rules/ → .vibe/rules/\n');
      removeDirRecursive(oldRulesDir);
      if (fs.existsSync(oldAgentDir) && fs.readdirSync(oldAgentDir).length === 0) {
        fs.rmdirSync(oldAgentDir);
      }
      log('   ✅ 기존 .agent/rules/ 폴더 정리 완료\n');
    }

    // .claude/commands 업데이트
    const commandsDir = path.join(claudeDir, 'commands');
    ensureDir(commandsDir);
    const sourceDir = path.join(__dirname, '../../.claude/commands');
    copyDirContents(sourceDir, commandsDir);
    log('   ✅ 슬래시 커맨드 업데이트 완료 (7개)\n');

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);

    // config.json 업데이트
    const configPath = path.join(vibeDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config.stacks = detectedStacks;
        config.details = stackDetails;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch (e) {}
    }

    // constitution.md 업데이트
    const templatePath = path.join(__dirname, '../../templates/constitution-template.md');
    const constitutionPath = path.join(vibeDir, 'constitution.md');
    if (fs.existsSync(templatePath)) {
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
      log('   ✅ constitution.md 업데이트 완료\n');
    }

    // .vibe/rules/ 업데이트
    const rulesSource = path.join(__dirname, '../../.vibe/rules');
    const rulesTarget = path.join(vibeDir, 'rules');

    const coreDirs = ['core', 'quality', 'standards', 'tools'];
    coreDirs.forEach(dir => {
      const src = path.join(rulesSource, dir);
      const dst = path.join(rulesTarget, dir);
      if (fs.existsSync(src)) {
        copyDirRecursive(src, dst);
      }
    });

    const langSource = path.join(rulesSource, 'languages');
    const langTarget = path.join(rulesTarget, 'languages');

    if (fs.existsSync(langTarget)) {
      removeDirRecursive(langTarget);
    }
    ensureDir(langTarget);

    const detectedTypes = detectedStacks.map(s => s.type);
    if (fs.existsSync(langSource)) {
      const langFiles = fs.readdirSync(langSource);
      langFiles.forEach(file => {
        const langType = file.replace('.md', '');
        if (detectedTypes.includes(langType)) {
          fs.copyFileSync(path.join(langSource, file), path.join(langTarget, file));
        }
      });
    }

    if (detectedStacks.length > 0) {
      log(`   🔍 감지된 기술 스택: ${detectedTypes.join(', ')}\n`);
    }
    log('   ✅ 코딩 규칙 업데이트 완료 (.vibe/rules/)\n');

    // .claude/agents/ 업데이트
    const agentsDir = path.join(claudeDir, 'agents');
    ensureDir(agentsDir);
    const agentsSourceDir = path.join(__dirname, '../../.claude/agents');
    copyDirContents(agentsSourceDir, agentsDir);
    log('   ✅ 서브에이전트 업데이트 완료 (.claude/agents/)\n');

    // settings.json 업데이트
    const settingsPath = path.join(claudeDir, 'settings.json');
    const hooksTemplate = path.join(__dirname, '../../templates/hooks-template.json');

    if (fs.existsSync(hooksTemplate)) {
      const vibeHooks = JSON.parse(fs.readFileSync(hooksTemplate, 'utf-8'));

      if (fs.existsSync(settingsPath)) {
        const existingSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        existingSettings.hooks = vibeHooks.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
        log('   ✅ Hooks 설정 업데이트 완료\n');
      } else {
        fs.copyFileSync(hooksTemplate, settingsPath);
        log('   ✅ Hooks 설정 생성 완료\n');
      }

      // settings.local.json도 업데이트
      const settingsLocalPath = path.join(claudeDir, 'settings.local.json');
      if (fs.existsSync(settingsLocalPath)) {
        try {
          const localSettings = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf-8'));
          if (localSettings.hooks) {
            localSettings.hooks = vibeHooks.hooks;
            fs.writeFileSync(settingsLocalPath, JSON.stringify(localSettings, null, 2));
            log('   ✅ 로컬 Hooks 설정 업데이트 완료\n');
          }
        } catch (e) {}
      }
    }

    // .gitignore에서 settings.local.json 제거
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      if (gitignore.includes('settings.local.json')) {
        gitignore = gitignore.replace(/\.claude\/settings\.local\.json\n?/g, '');
        gitignore = gitignore.replace(/settings\.local\.json\n?/g, '');
        fs.writeFileSync(gitignorePath, gitignore);
        log('   ✅ .gitignore에서 settings.local.json 제거\n');
      }
    }

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // MCP 서버 등록
    const geminiMcpPath = path.join(__dirname, '../lib/gemini-mcp.js');
    const gptMcpPath = path.join(__dirname, '../lib/gpt-mcp.js');

    // ~/.claude.json 정리
    const claudeConfigPath = path.join(os.homedir(), '.claude.json');
    if (fs.existsSync(claudeConfigPath)) {
      try {
        const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf-8'));
        let configModified = false;

        if (claudeConfig.projects) {
          for (const [projectPath, projectConfig] of Object.entries(claudeConfig.projects) as [string, any][]) {
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
      } catch (e: any) {
        log('   ⚠️  ~/.claude.json 정리 실패: ' + e.message + '\n');
      }
    }

    // MCP 등록 (hi-ai는 내장 도구로 전환됨)
    try {
      // 기존 vibe MCP 제거 (hi-ai 기반 → 내장 도구로 마이그레이션)
      try { execSync('claude mcp remove vibe', { stdio: 'pipe' }); } catch (e) {}
      try { execSync('claude mcp remove vibe -s user', { stdio: 'pipe' }); } catch (e) {}

      // vibe-gemini MCP 등록
      try { execSync('claude mcp remove vibe-gemini', { stdio: 'pipe' }); } catch (e) {}
      try { execSync('claude mcp remove vibe-gemini -s user', { stdio: 'pipe' }); } catch (e) {}
      if (fs.existsSync(geminiMcpPath)) {
        try {
          execSync(`claude mcp add vibe-gemini -s user node "${geminiMcpPath}"`, { stdio: 'pipe' });
          log('   ✅ vibe-gemini MCP 전역 등록 완료\n');
        } catch (e: any) {
          if (e.message.includes('already exists')) {
            log('   ℹ️  vibe-gemini MCP 이미 등록됨\n');
          }
        }
      }

      // vibe-gpt MCP 등록
      try { execSync('claude mcp remove vibe-gpt', { stdio: 'pipe' }); } catch (e) {}
      try { execSync('claude mcp remove vibe-gpt -s user', { stdio: 'pipe' }); } catch (e) {}
      if (fs.existsSync(gptMcpPath)) {
        try {
          execSync(`claude mcp add vibe-gpt -s user node "${gptMcpPath}"`, { stdio: 'pipe' });
          log('   ✅ vibe-gpt MCP 전역 등록 완료\n');
        } catch (e: any) {
          if (e.message.includes('already exists')) {
            log('   ℹ️  vibe-gpt MCP 이미 등록됨\n');
          }
        }
      }

      // context7 MCP 등록
      try { execSync('claude mcp remove context7', { stdio: 'pipe' }); } catch (e) {}
      try {
        execSync('claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest', { stdio: 'pipe' });
        log('   ✅ context7 MCP 전역 등록 완료\n');
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          log('   ℹ️  context7 MCP 이미 등록됨\n');
        }
      }
    } catch (e) {
      log('   ⚠️  MCP 등록 실패\n');
    }

    // 기존 .vibe/mcp/ 폴더 정리
    const oldMcpDir = path.join(vibeDir, 'mcp');
    if (fs.existsSync(oldMcpDir)) {
      log('   🧹 기존 .vibe/mcp/ 폴더 정리 중...\n');
      try {
        removeDirRecursive(oldMcpDir);
        log('   ✅ .vibe/mcp/ 폴더 삭제 완료\n');
      } catch (e) {
        log('   ⚠️  .vibe/mcp/ 폴더 수동 삭제 필요\n');
      }
    }

    const packageJson = getPackageJson();
    log(`
✅ vibe 업데이트 완료! (v${packageJson.version})

업데이트된 항목:
  - 슬래시 커맨드 (7개)
  - 코딩 규칙 (.vibe/rules/)
  - 서브에이전트 (.claude/agents/)
  - Hooks 설정

${formatLLMStatus()}
    `);

  } catch (error: any) {
    console.error('❌ 업데이트 실패:', error.message);
    process.exit(1);
  }
}

function remove(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.vibe');
  const claudeDir = path.join(projectRoot, '.claude');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다.');
    return;
  }

  console.log('🗑️  vibe 제거 중...\n');

  // MCP 서버 제거
  try {
    execSync('claude mcp remove vibe', { stdio: 'pipe' });
    console.log('   ✅ vibe MCP 제거 완료\n');
  } catch (e) {
    console.log('   ℹ️  vibe MCP 이미 제거됨 또는 없음\n');
  }

  try {
    execSync('claude mcp remove context7', { stdio: 'pipe' });
    console.log('   ✅ context7 MCP 제거 완료\n');
  } catch (e) {
    console.log('   ℹ️  context7 MCP 이미 제거됨 또는 없음\n');
  }

  // .vibe 폴더 제거
  if (fs.existsSync(vibeDir)) {
    removeDirRecursive(vibeDir);
    console.log('   ✅ .vibe/ 폴더 제거 완료\n');
  }

  // .claude/commands 제거
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const vibeCommands = ['vibe.spec.md', 'vibe.run.md', 'vibe.verify.md', 'vibe.reason.md', 'vibe.analyze.md', 'vibe.ui.md', 'vibe.diagram.md'];
    vibeCommands.forEach(cmd => {
      const cmdPath = path.join(commandsDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    });
    console.log('   ✅ 슬래시 커맨드 제거 완료\n');
  }

  // .claude/agents 제거
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const vibeAgents = ['simplifier.md', 'explorer.md', 'implementer.md', 'tester.md', 'searcher.md'];
    vibeAgents.forEach(agent => {
      const agentPath = path.join(agentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
    });
    console.log('   ✅ 서브에이전트 제거 완료\n');
  }

  // .claude/settings.json에서 hooks 제거
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.hooks) {
        delete settings.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log('   ✅ Hooks 설정 제거 완료\n');
      }
    } catch (e) {}
  }

  console.log(`
✅ vibe 제거 완료!

제거된 항목:
  - MCP 서버 (vibe, context7)
  - .vibe/ 폴더
  - 슬래시 커맨드 (7개)
  - 서브에이전트 (5개)
  - Hooks 설정

다시 설치하려면: vibe init
  `);
}

// ============================================================================
// External LLM Commands
// ============================================================================

function setupExternalLLM(llmType: string, apiKey: string): void {
  if (!apiKey) {
    console.log(`
❌ API 키가 필요합니다.

사용법:
  vibe ${llmType} <api-key>

${llmType === 'gpt' ? 'OpenAI API 키: https://platform.openai.com/api-keys' : 'Google API 키: https://aistudio.google.com/apikey'}
    `);
    return;
  }

  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다. 먼저 vibe init을 실행하세요.');
    return;
  }

  let config: VibeConfig = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  if (!config.models) {
    config.models = {};
  }

  const llmConfig = EXTERNAL_LLMS[llmType];
  config.models[llmType as 'gpt' | 'gemini'] = {
    enabled: true,
    role: llmConfig.role,
    description: llmConfig.description
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const envKey = llmConfig.envKey;

  try {
    try {
      execSync(`claude mcp remove ${llmConfig.name} -s user`, { stdio: 'pipe' });
    } catch (e) {}

    execSync(`claude mcp add ${llmConfig.name} -s user -e ${envKey}=${apiKey} -- npx -y ${llmConfig.package}`, { stdio: 'pipe' });

    console.log(`
✅ ${llmType.toUpperCase()} 활성화 완료! (전역)

역할: ${llmConfig.description}
MCP: ${llmConfig.name}

모든 프로젝트에서 /vibe.run 실행 시 자동으로 활용됩니다.

비활성화: vibe ${llmType} --remove
    `);
  } catch (e) {
    console.log(`
⚠️  MCP 등록 실패. 수동으로 등록하세요:

claude mcp add ${llmConfig.name} -s user -e ${envKey}=<your-key> -- npx -y ${llmConfig.package}
    `);
  }
}

function removeExternalLLM(llmType: string): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다.');
    return;
  }

  if (fs.existsSync(configPath)) {
    const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.models?.[llmType as 'gpt' | 'gemini']) {
      config.models[llmType as 'gpt' | 'gemini']!.enabled = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  }

  const llmConfig = EXTERNAL_LLMS[llmType];

  try {
    try { execSync(`claude mcp remove ${llmConfig.name}`, { stdio: 'pipe' }); } catch (e) {}
    try { execSync(`claude mcp remove ${llmConfig.name} -s user`, { stdio: 'pipe' }); } catch (e) {}
    console.log(`✅ ${llmType.toUpperCase()} 비활성화 완료`);
  } catch (e) {
    console.log(`ℹ️  ${llmType.toUpperCase()} MCP가 등록되어 있지 않습니다.`);
  }
}

// ============================================================================
// GPT OAuth Commands
// ============================================================================

async function gptAuth(): Promise<void> {
  console.log(`
🔐 GPT Plus/Pro 인증 (OAuth)

ChatGPT Plus 또는 Pro 구독이 있으면 Codex API를 사용할 수 있습니다.
브라우저에서 OpenAI 계정으로 로그인하세요.
  `);

  try {
    const gptOAuthPath = path.join(__dirname, '../lib/gpt-oauth.js');
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');

    const { startOAuthFlow } = require(gptOAuthPath);
    const storage = require(gptStoragePath);

    const tokens: OAuthTokens = await startOAuthFlow();

    storage.addAccount({
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      expires: tokens.expires,
      accountId: tokens.accountId,
    });

    console.log(`
✅ GPT 인증 완료!

계정: ${tokens.email}
계정 ID: ${tokens.accountId || '(자동 감지)'}

⚠️  참고: ChatGPT Plus/Pro 구독이 있어야 API 호출이 가능합니다.
    구독이 없으면 인증은 성공하지만 API 호출 시 오류가 발생합니다.

상태 확인: vibe gpt --status
로그아웃: vibe gpt --logout
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.vibe');
    const configPath = path.join(vibeDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.models) config.models = {};
        config.models.gpt = {
          enabled: true,
          authType: 'oauth',
          email: tokens.email,
          role: 'architecture',
          description: 'GPT (ChatGPT Plus/Pro)',
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch (e) {}
    }

    process.exit(0);

  } catch (error: any) {
    console.error(`
❌ GPT 인증 실패

오류: ${error.message}

다시 시도하려면: vibe gpt --auth
    `);
    process.exit(1);
  }
}

function gptStatus(): void {
  try {
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
    const storage = require(gptStoragePath);

    const accounts = storage.getAllAccounts();

    if (accounts.length === 0) {
      console.log(`
📊 GPT 인증 상태

인증된 계정 없음

로그인: vibe gpt --auth
      `);
      return;
    }

    const activeAccount = storage.getActiveAccount();
    const isExpired = storage.isTokenExpired(activeAccount);

    console.log(`
📊 GPT 인증 상태

활성 계정: ${activeAccount.email}
계정 ID: ${activeAccount.accountId || '(없음)'}
토큰 상태: ${isExpired ? '⚠️  만료됨 (자동 갱신됨)' : '✅ 유효'}
마지막 사용: ${new Date(activeAccount.lastUsed).toLocaleString()}

등록된 계정 (${accounts.length}개):
${accounts.map((acc: any, i: number) => `  ${i === storage.loadAccounts()?.activeIndex ? '→' : ' '} ${acc.email}`).join('\n')}

⚠️  참고: ChatGPT Plus/Pro 구독이 있어야 API 호출이 가능합니다.

로그아웃: vibe gpt --logout
    `);

  } catch (error: any) {
    console.error('상태 확인 실패:', error.message);
  }
}

function gptLogout(): void {
  try {
    const gptStoragePath = path.join(__dirname, '../lib/gpt-storage.js');
    const storage = require(gptStoragePath);

    const activeAccount = storage.getActiveAccount();

    if (!activeAccount) {
      console.log('로그인된 계정이 없습니다.');
      return;
    }

    storage.clearAccounts();

    console.log(`
✅ GPT 로그아웃 완료

${activeAccount.email} 계정이 제거되었습니다.

다시 로그인: vibe gpt --auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.vibe');
    const configPath = path.join(vibeDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gpt) {
          config.models.gpt.enabled = false;
          config.models.gpt.authType = undefined;
          config.models.gpt.email = undefined;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch (e) {}
    }

  } catch (error: any) {
    console.error('로그아웃 실패:', error.message);
  }
}

function showGptHelp(): void {
  console.log(`
🤖 GPT 설정

ChatGPT Plus 또는 Pro 구독이 있으면 OpenAI Codex API를 사용할 수 있습니다.

사용 방법:

  1. OAuth 인증 (권장):
     vibe gpt --auth       OpenAI 계정으로 로그인 (Plus/Pro 구독 필요)

  2. API 키 방식:
     vibe gpt <api-key>    API 키로 설정 (사용량 과금)

관리 명령어:
  vibe gpt --status      인증 상태 확인
  vibe gpt --logout      로그아웃
  vibe gpt --remove      API 키 제거

⚠️  중요:
  - OAuth 인증은 ChatGPT Plus 또는 Pro 구독이 있어야 API 호출 가능
  - 구독이 없으면 인증은 성공하지만 API 호출 시 권한 오류 발생
  - API 키 방식은 OpenAI Platform의 별도 과금 (구독과 무관)
  `);
}

// ============================================================================
// Gemini OAuth Commands
// ============================================================================

async function geminiAuth(): Promise<void> {
  console.log(`
🔐 Gemini 구독 인증 (OAuth)

Gemini Advanced 구독이 있으면 추가 비용 없이 사용할 수 있습니다.
브라우저에서 Google 계정으로 로그인하세요.
  `);

  try {
    const geminiOAuthPath = path.join(__dirname, '../lib/gemini-oauth.js');
    const geminiStoragePath = path.join(__dirname, '../lib/gemini-storage.js');

    const { startOAuthFlow } = require(geminiOAuthPath);
    const storage = require(geminiStoragePath);

    const tokens: OAuthTokens = await startOAuthFlow();

    storage.addAccount({
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expires: tokens.expires,
      projectId: tokens.projectId,
    });

    console.log(`
✅ Gemini 인증 완료!

계정: ${tokens.email}
프로젝트: ${tokens.projectId || '(자동 감지)'}

사용 가능한 모델:
  - Gemini 3 Flash (빠른 응답, 탐색/검색)
  - Gemini 3 Pro (높은 정확도)

/vibe.run 실행 시 자동으로 Gemini가 보조 모델로 활용됩니다.

상태 확인: vibe gemini --status
로그아웃: vibe gemini --logout
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.vibe');
    const configPath = path.join(vibeDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.models) config.models = {};
        config.models.gemini = {
          enabled: true,
          authType: 'oauth',
          email: tokens.email,
          role: 'exploration',
          description: 'Gemini 3 Flash/Pro (탐색, UI/UX)',
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } catch (e) {}
    }

    // MCP 서버 등록
    try {
      const mcpPath = path.join(__dirname, '../lib/gemini-mcp.js');

      try { execSync('claude mcp remove vibe-gemini -s user', { stdio: 'ignore' }); } catch (e) {}
      execSync(`claude mcp add vibe-gemini -s user node "${mcpPath}"`, { stdio: 'inherit' });

      console.log(`
✅ vibe-gemini MCP 서버 등록 완료! (전역)

이제 모든 프로젝트에서 다음 도구를 사용할 수 있습니다:
  - mcp__vibe-gemini__gemini_chat: Gemini에 질문
  - mcp__vibe-gemini__gemini_analyze_code: 코드 분석
  - mcp__vibe-gemini__gemini_review_ui: UI/UX 리뷰
  - mcp__vibe-gemini__gemini_quick_ask: 빠른 질문
      `);
    } catch (mcpError) {
      console.log(`
⚠️  MCP 서버 등록 실패 (수동 등록 필요):
  claude mcp add vibe-gemini -s user node "${path.join(__dirname, '../lib/gemini-mcp.js')}"
      `);
    }

    process.exit(0);

  } catch (error: any) {
    console.error(`
❌ Gemini 인증 실패

오류: ${error.message}

다시 시도하려면: vibe gemini --auth
    `);
    process.exit(1);
  }
}

function geminiStatus(): void {
  try {
    const geminiStoragePath = path.join(__dirname, '../lib/gemini-storage.js');
    const geminiApiPath = path.join(__dirname, '../lib/gemini-api.js');

    const storage = require(geminiStoragePath);
    const { GEMINI_MODELS } = require(geminiApiPath);

    const accounts = storage.getAllAccounts();

    if (accounts.length === 0) {
      console.log(`
📊 Gemini 인증 상태

인증된 계정 없음

로그인: vibe gemini --auth
      `);
      return;
    }

    const activeAccount = storage.getActiveAccount();
    const isExpired = storage.isTokenExpired(activeAccount);

    console.log(`
📊 Gemini 인증 상태

활성 계정: ${activeAccount.email}
프로젝트: ${activeAccount.projectId || '(자동)'}
토큰 상태: ${isExpired ? '⚠️  만료됨 (자동 갱신됨)' : '✅ 유효'}
마지막 사용: ${new Date(activeAccount.lastUsed).toLocaleString()}

등록된 계정 (${accounts.length}개):
${accounts.map((acc: any, i: number) => `  ${i === storage.loadAccounts()?.activeIndex ? '→' : ' '} ${acc.email}`).join('\n')}

사용 가능한 모델:
${Object.entries(GEMINI_MODELS).map(([id, info]: [string, any]) => `  - ${id}: ${info.description}`).join('\n')}

로그아웃: vibe gemini --logout
    `);

  } catch (error: any) {
    console.error('상태 확인 실패:', error.message);
  }
}

function geminiLogout(): void {
  try {
    const geminiStoragePath = path.join(__dirname, '../lib/gemini-storage.js');
    const storage = require(geminiStoragePath);

    const activeAccount = storage.getActiveAccount();

    if (!activeAccount) {
      console.log('로그인된 계정이 없습니다.');
      return;
    }

    storage.clearAccounts();

    console.log(`
✅ Gemini 로그아웃 완료

${activeAccount.email} 계정이 제거되었습니다.

다시 로그인: vibe gemini --auth
    `);

    // config.json 업데이트
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.vibe');
    const configPath = path.join(vibeDir, 'config.json');

    if (fs.existsSync(configPath)) {
      try {
        const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.models?.gemini) {
          config.models.gemini.enabled = false;
          config.models.gemini.authType = undefined;
          config.models.gemini.email = undefined;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
      } catch (e) {}
    }

  } catch (error: any) {
    console.error('로그아웃 실패:', error.message);
  }
}

function showGeminiHelp(): void {
  console.log(`
🤖 Gemini 설정

Gemini Advanced 구독이 있으면 추가 비용 없이 AI 보조 모델로 활용할 수 있습니다.

사용 방법:

  1. 구독 인증 (권장):
     vibe gemini --auth       Google 계정으로 로그인 (추가 비용 없음)

  2. API 키 방식:
     vibe gemini <api-key>    API 키로 설정 (사용량 과금)

관리 명령어:
  vibe gemini --status      인증 상태 확인
  vibe gemini --logout      로그아웃
  vibe gemini --remove      API 키 제거

사용 가능한 모델:
  - gemini-2.5-flash: 안정적, Thinking 기능 (기본)
  - gemini-2.5-flash-lite: 경량 버전
  - gemini-3-flash: 최신 프리뷰, 빠름
  - gemini-3-pro: 최신 프리뷰, 정확

활용 방식:
  /vibe.run 실행 시 자동으로 다음 용도로 활용됩니다:
  - 코드 탐색/검색 (Gemini 3 Flash)
  - UI/UX 분석 (Gemini 3 Pro)
  - 병렬 작업 처리
  `);
}

// ============================================================================
// Info Commands
// ============================================================================

function showHelp(): void {
  console.log(`
📖 Vibe - SPEC-driven AI coding framework (Claude Code 전용)

기본 명령어:
  vibe init [project]     프로젝트 초기화
  vibe update             설정 업데이트
  vibe remove             vibe 제거 (MCP, 설정, 패키지)
  vibe status             현재 설정 상태
  vibe help               도움말
  vibe version            버전 정보

외부 LLM (선택적):
  vibe gpt --auth         GPT Plus/Pro 인증 (OAuth)
  vibe gpt <api-key>      GPT API 키 설정 (사용량 과금)
  vibe gpt --status       GPT 인증 상태 확인
  vibe gpt --logout       GPT 로그아웃
  vibe gpt --remove       GPT 비활성화
  vibe gemini --auth      Gemini 구독 인증 (추가 비용 없음, 권장)
  vibe gemini <api-key>   Gemini API 키 설정 (사용량 과금)
  vibe gemini --status    Gemini 인증 상태 확인
  vibe gemini --logout    Gemini 로그아웃
  vibe gemini --remove    Gemini API 키 제거

Claude Code 슬래시 커맨드:
  /vibe.spec "기능명"     SPEC 작성 (PTCF 구조)
  /vibe.run "기능명"      구현 실행
  /vibe.verify "기능명"   검증
  /vibe.reason "문제"     체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.ui "설명"         UI 미리보기
  /vibe.diagram           다이어그램 생성

모델 오케스트레이션:
  Opus 4.5    오케스트레이터 (메인)
  Sonnet 4    구현
  Haiku 4.5   코드 탐색
  GPT 5.2     아키텍처/디버깅 (선택적)
  Gemini 3    UI/UX 설계 (선택적)

Workflow:
  /vibe.spec → /vibe.run → /vibe.verify

문서:
  https://github.com/su-record/vibe
  `);
}

function showStatus(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다. 먼저 vibe init을 실행하세요.');
    return;
  }

  const packageJson = getPackageJson();
  let config: VibeConfig = { language: 'ko', models: {} };
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  const gptStatus = config.models?.gpt?.enabled ? '✅ 활성' : '⬚ 비활성';
  const geminiStatus = config.models?.gemini?.enabled ? '✅ 활성' : '⬚ 비활성';

  console.log(`
📊 Vibe 상태 (v${packageJson.version})

프로젝트: ${projectRoot}
언어: ${config.language || 'ko'}

모델 오케스트레이션:
┌─────────────────────────────────────────┐
│ Opus 4.5          오케스트레이터        │
├─────────────────────────────────────────┤
│ Sonnet 4          구현                  │
│ Haiku 4.5         코드 탐색             │
├─────────────────────────────────────────┤
│ GPT 5.2           ${gptStatus}  아키텍처/디버깅    │
│ Gemini 3          ${geminiStatus}  UI/UX 설계        │
└─────────────────────────────────────────┘

MCP 서버:
  vibe-gemini       Gemini API
  vibe-gpt          GPT API
  context7          라이브러리 문서 검색

외부 LLM 설정:
  vibe gpt <key>      GPT 활성화 (아키텍처/디버깅)
  vibe gemini <key>   Gemini 활성화 (UI/UX)
  vibe <name> --remove  비활성화
  `);
}

function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`vibe v${packageJson.version}`);
}

// ============================================================================
// Tool Exports (for slash commands)
// ============================================================================

export * from '../lib/MemoryManager.js';
export * from '../lib/ProjectCache.js';
export * from '../lib/ContextCompressor.js';

export { saveMemory } from '../tools/memory/saveMemory.js';
export { recallMemory } from '../tools/memory/recallMemory.js';
export { listMemories } from '../tools/memory/listMemories.js';
export { deleteMemory } from '../tools/memory/deleteMemory.js';
export { updateMemory } from '../tools/memory/updateMemory.js';
export { searchMemoriesHandler as searchMemories } from '../tools/memory/searchMemories.js';
export { linkMemories } from '../tools/memory/linkMemories.js';
export { getMemoryGraph } from '../tools/memory/getMemoryGraph.js';
export { createMemoryTimeline } from '../tools/memory/createMemoryTimeline.js';
export { searchMemoriesAdvanced } from '../tools/memory/searchMemoriesAdvanced.js';
export { startSession } from '../tools/memory/startSession.js';
export { autoSaveContext } from '../tools/memory/autoSaveContext.js';
export { restoreSessionContext } from '../tools/memory/restoreSessionContext.js';
export { prioritizeMemory } from '../tools/memory/prioritizeMemory.js';
export { getSessionContext } from '../tools/memory/getSessionContext.js';

export { findSymbol } from '../tools/semantic/findSymbol.js';
export { findReferences } from '../tools/semantic/findReferences.js';
export { analyzeDependencyGraph } from '../tools/semantic/analyzeDependencyGraph.js';

export { analyzeComplexity } from '../tools/convention/analyzeComplexity.js';
export { validateCodeQuality } from '../tools/convention/validateCodeQuality.js';
export { checkCouplingCohesion } from '../tools/convention/checkCouplingCohesion.js';
export { suggestImprovements } from '../tools/convention/suggestImprovements.js';
export { applyQualityRules } from '../tools/convention/applyQualityRules.js';
export { getCodingGuide } from '../tools/convention/getCodingGuide.js';

export { createThinkingChain } from '../tools/thinking/createThinkingChain.js';
export { analyzeProblem } from '../tools/thinking/analyzeProblem.js';
export { stepByStepAnalysis } from '../tools/thinking/stepByStepAnalysis.js';
export { formatAsPlan } from '../tools/thinking/formatAsPlan.js';
export { breakDownProblem } from '../tools/thinking/breakDownProblem.js';
export { thinkAloudProcess } from '../tools/thinking/thinkAloudProcess.js';

export { generatePrd } from '../tools/planning/generatePrd.js';
export { createUserStories } from '../tools/planning/createUserStories.js';
export { analyzeRequirements } from '../tools/planning/analyzeRequirements.js';
export { featureRoadmap } from '../tools/planning/featureRoadmap.js';

export { enhancePrompt } from '../tools/prompt/enhancePrompt.js';
export { analyzePrompt } from '../tools/prompt/analyzePrompt.js';

export { previewUiAscii } from '../tools/ui/previewUiAscii.js';
export { getCurrentTime } from '../tools/time/getCurrentTime.js';

// ============================================================================
// Main Router
// ============================================================================

switch (command) {
  case 'init':
    init(positionalArgs[1]);
    break;

  case 'update':
    update();
    break;

  case 'remove':
  case 'uninstall':
    remove();
    break;

  case 'gpt':
    if (args[1] === '--remove') {
      removeExternalLLM('gpt');
    } else if (args[1] === '--auth') {
      gptAuth();
    } else if (args[1] === '--status') {
      gptStatus();
    } else if (args[1] === '--logout') {
      gptLogout();
    } else if (args[1]) {
      setupExternalLLM('gpt', args[1]);
    } else {
      showGptHelp();
    }
    break;

  case 'gemini':
    if (args[1] === '--remove') {
      removeExternalLLM('gemini');
    } else if (args[1] === '--auth') {
      geminiAuth();
    } else if (args[1] === '--status') {
      geminiStatus();
    } else if (args[1] === '--logout') {
      geminiLogout();
    } else if (args[1]) {
      setupExternalLLM('gemini', args[1]);
    } else {
      showGeminiHelp();
    }
    break;

  case 'status':
    showStatus();
    break;

  case 'version':
  case '-v':
  case '--version':
    showVersion();
    break;

  case 'help':
  case '-h':
  case '--help':
  case undefined:
    showHelp();
    break;

  default:
    console.log(`
❌ 알 수 없는 명령어: ${command}

사용 가능한 명령어:
  vibe init       프로젝트 초기화
  vibe update     설정 업데이트
  vibe gpt        GPT 활성화/비활성화
  vibe gemini     Gemini 활성화/비활성화
  vibe status     현재 설정 상태
  vibe help       도움말
  vibe version    버전 정보

사용법: vibe help
    `);
    process.exit(1);
}
