/**
 * 협업자 자동 설치 설정
 */

import path from 'path';
import fs from 'fs';
import { log, getPackageJson } from './utils.js';

/**
 * 협업자 자동 설치 설정
 */
export function setupCollaboratorAutoInstall(projectRoot: string): void {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log('   ⚠️  package.json 수정 실패: ' + message + '\n');
    }
  }

  // 2. .claude/vibe/setup.sh 생성
  const setupShPath = path.join(vibeDir, 'setup.sh');
  if (!fs.existsSync(vibeDir)) {
    fs.mkdirSync(vibeDir, { recursive: true });
  }
  if (!fs.existsSync(setupShPath)) {
    const setupScript = `#!/bin/bash
# Vibe 협업자 자동 설치 스크립트
# 사용법: ./.claude/vibe/setup.sh

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
    log('   ✅ 협업자 설치 스크립트 생성 (.claude/vibe/setup.sh)\n');
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
./.claude/vibe/setup.sh
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
