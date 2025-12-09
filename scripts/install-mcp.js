#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 vibe MCP 서버 설치 중...\n');

// vibe 패키지의 실제 설치 경로 찾기
const vibePackagePath = path.dirname(__dirname);

// MCP 서버 경로 (hi-ai 패키지)
const mcpIndexPath = path.join(vibePackagePath, 'node_modules', '@su-record', 'hi-ai', 'dist', 'index.js');

// hi-ai 설치 확인
if (!fs.existsSync(mcpIndexPath)) {
  console.log('⚠️  hi-ai MCP 서버를 찾을 수 없습니다.');
  console.log('   경로:', mcpIndexPath);
  console.log('   npm install을 실행해주세요.\n');
  process.exit(1);
}

console.log('📍 MCP 서버 경로:', mcpIndexPath);
console.log('');

// ============================================
// 에이전트 설정
// ============================================

const projectRoot = process.cwd();

const AGENTS = [
  {
    name: 'Claude Code',
    emoji: '1️⃣',
    setup: () => {
      try {
        execSync(`claude mcp add vibe node "${mcpIndexPath}"`, { stdio: 'inherit' });
        return { success: true };
      } catch (error) {
        const msg = error.message + (error.stderr?.toString() || '') + (error.stdout?.toString() || '');
        if (msg.includes('already exists')) {
          return { success: true, message: '이미 등록되어 있습니다' };
        }
        return { success: false, message: '수동 등록 필요' };
      }
    }
  },
  {
    name: 'Cursor',
    emoji: '2️⃣',
    configPath: '.cursor/mcp.json',
    setup: function() {
      return writeJsonConfig(path.join(projectRoot, this.configPath));
    }
  },
  {
    name: 'Gemini CLI',
    emoji: '3️⃣',
    configPath: '.gemini/settings.json',
    setup: function() {
      return writeJsonConfig(path.join(projectRoot, this.configPath));
    }
  },
  {
    name: 'Antigravity',
    emoji: '4️⃣',
    configPath: '.idx/mcp.json',
    setup: function() {
      return writeJsonConfig(path.join(projectRoot, this.configPath));
    }
  }
];

// JSON 설정 파일 작성 유틸리티
function writeJsonConfig(configPath) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let config = { mcpServers: {} };
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.mcpServers) config.mcpServers = {};
      } catch (e) {}
    }

    config.mcpServers.vibe = {
      command: 'node',
      args: [mcpIndexPath]
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true, path: configPath };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ============================================
// 등록 실행
// ============================================

AGENTS.forEach(agent => {
  console.log(`${agent.emoji}  ${agent.name} MCP 등록...`);

  const result = agent.setup();

  if (result.success) {
    if (result.message) {
      console.log(`   ℹ️  ${result.message}\n`);
    } else if (result.path) {
      console.log(`   ✅ 완료`);
      console.log(`   📁 ${result.path}\n`);
    } else {
      console.log(`   ✅ 완료\n`);
    }
  } else {
    console.log(`   ⚠️  실패: ${result.message}\n`);
  }
});

// ============================================
// 완료 메시지
// ============================================
console.log('✅ vibe MCP 서버 등록 완료!\n');
console.log('사용 가능한 도구:');
console.log('  - 38개 MCP 도구 (@su-record/hi-ai 기반)');
console.log('  - 코드 분석, 품질 검증, UI 미리보기 등\n');
console.log('확인 방법:');
console.log('  Claude Code:  claude mcp list');
console.log('  Cursor:       .cursor/mcp.json');
console.log('  Gemini CLI:   .gemini/settings.json');
console.log('  Antigravity:  .idx/mcp.json');
console.log('');
