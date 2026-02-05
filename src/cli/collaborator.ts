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
  const coreDir = path.join(projectRoot, '.claude', 'vibe');

  // 1. Node.js 프로젝트: package.json 정리
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      let modified = false;

      // 기존 devDependencies에서 @su-record/core 제거
      if (pkg.devDependencies?.['@su-record/core']) {
        delete pkg.devDependencies['@su-record/core'];
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
      }
    } catch { /* ignore: optional operation */ }
  }

  // 2. .claude/vibe/setup.sh 생성
  const setupShPath = path.join(coreDir, 'setup.sh');
  if (!fs.existsSync(coreDir)) {
    fs.mkdirSync(coreDir, { recursive: true });
  }
  if (!fs.existsSync(setupShPath)) {
    const setupScript = `#!/bin/bash
# Core collaborator auto-install script
# Usage: ./.claude/vibe/setup.sh

set -e

echo "🔧 Checking Core installation..."

# Check npm/npx
if ! command -v npx &> /dev/null; then
    echo "❌ Node.js/npm is not installed."
    echo "   Please install from https://nodejs.org"
    exit 1
fi

# Check core installation and update
if command -v vibe &> /dev/null; then
    echo "✅ Core is already installed."
    vibe update --silent
    echo "✅ Core updated!"
else
    echo "📦 Installing Core..."
    npm install -g @su-record/core
    vibe update --silent
    echo "✅ Core installed and configured!"
fi

echo ""
echo "Get started with:"
echo "  /vibe.spec \\"feature\\"    Create SPEC"
echo "  /vibe.run \\"feature\\"     Implement"
`;
    fs.writeFileSync(setupShPath, setupScript);
    fs.chmodSync(setupShPath, '755');
  }

  // 3. README.md에 협업자 안내 추가
  const readmePath = path.join(projectRoot, 'README.md');
  const coreSetupSection = `
## Core Setup (AI Coding)

This project uses [Core](https://github.com/su-record/core) AI coding framework.

### Collaborator Install

\`\`\`bash
# Global install (recommended)
npm install -g @su-record/core
vibe update

# Or use vibe init to setup
vibe init
\`\`\`

### Usage

Use slash commands in Claude Code:
- \`/vibe.spec "feature"\` - Create SPEC document
- \`/vibe.run "feature"\` - Execute implementation
`;

  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf-8');
    if (!readme.includes('## Core Setup')) {
      fs.appendFileSync(readmePath, coreSetupSection);
    }
  } else {
    fs.writeFileSync(readmePath, `# Project\n${coreSetupSection}`);
  }
}
