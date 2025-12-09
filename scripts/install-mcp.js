#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
// 1. Claude Code MCP 등록
// ============================================
console.log('1️⃣  Claude Code MCP 등록...');

try {
  const command = `claude mcp add vibe node "${mcpIndexPath}"`;
  execSync(command, { stdio: 'inherit' });
  console.log('   ✅ Claude Code 등록 완료\n');
} catch (error) {
  const fullOutput = error.message + (error.stderr?.toString() || '') + (error.stdout?.toString() || '');

  if (fullOutput.includes('already exists')) {
    console.log('   ℹ️  이미 등록되어 있습니다\n');
  } else {
    console.log('   ⚠️  Claude Code 등록 실패 (수동 등록 필요)\n');
  }
}

// ============================================
// 2. Cursor MCP 등록
// ============================================
console.log('2️⃣  Cursor MCP 등록...');

const projectRoot = process.cwd();
const cursorDir = path.join(projectRoot, '.cursor');
const cursorMcpPath = path.join(cursorDir, 'mcp.json');

try {
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }

  let cursorConfig = { mcpServers: {} };
  if (fs.existsSync(cursorMcpPath)) {
    try {
      cursorConfig = JSON.parse(fs.readFileSync(cursorMcpPath, 'utf-8'));
      if (!cursorConfig.mcpServers) {
        cursorConfig.mcpServers = {};
      }
    } catch (e) {}
  }

  cursorConfig.mcpServers.vibe = {
    command: 'node',
    args: [mcpIndexPath]
  };

  fs.writeFileSync(cursorMcpPath, JSON.stringify(cursorConfig, null, 2));
  console.log('   ✅ Cursor 등록 완료');
  console.log(`   📁 ${cursorMcpPath}\n`);

} catch (error) {
  console.log('   ⚠️  Cursor 등록 실패:', error.message, '\n');
}

// ============================================
// 3. Gemini CLI MCP 등록
// ============================================
console.log('3️⃣  Gemini CLI MCP 등록...');

const geminiDir = path.join(projectRoot, '.gemini');
const geminiSettingsPath = path.join(geminiDir, 'settings.json');

try {
  if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
  }

  let geminiConfig = { mcpServers: {} };
  if (fs.existsSync(geminiSettingsPath)) {
    try {
      geminiConfig = JSON.parse(fs.readFileSync(geminiSettingsPath, 'utf-8'));
      if (!geminiConfig.mcpServers) {
        geminiConfig.mcpServers = {};
      }
    } catch (e) {}
  }

  geminiConfig.mcpServers.vibe = {
    command: 'node',
    args: [mcpIndexPath]
  };

  fs.writeFileSync(geminiSettingsPath, JSON.stringify(geminiConfig, null, 2));
  console.log('   ✅ Gemini CLI 등록 완료');
  console.log(`   📁 ${geminiSettingsPath}\n`);

} catch (error) {
  console.log('   ⚠️  Gemini CLI 등록 실패:', error.message, '\n');
}

// ============================================
// 4. Antigravity MCP 등록
// ============================================
console.log('4️⃣  Antigravity MCP 등록...');

const antigravityDir = path.join(projectRoot, '.idx');
const antigravityMcpPath = path.join(antigravityDir, 'mcp.json');

try {
  if (!fs.existsSync(antigravityDir)) {
    fs.mkdirSync(antigravityDir, { recursive: true });
  }

  let antigravityConfig = { mcpServers: {} };
  if (fs.existsSync(antigravityMcpPath)) {
    try {
      antigravityConfig = JSON.parse(fs.readFileSync(antigravityMcpPath, 'utf-8'));
      if (!antigravityConfig.mcpServers) {
        antigravityConfig.mcpServers = {};
      }
    } catch (e) {}
  }

  antigravityConfig.mcpServers.vibe = {
    command: 'node',
    args: [mcpIndexPath]
  };

  fs.writeFileSync(antigravityMcpPath, JSON.stringify(antigravityConfig, null, 2));
  console.log('   ✅ Antigravity 등록 완료');
  console.log(`   📁 ${antigravityMcpPath}\n`);

} catch (error) {
  console.log('   ⚠️  Antigravity 등록 실패:', error.message, '\n');
}

// ============================================
// 완료 메시지
// ============================================
console.log('✅ vibe MCP 서버 등록 완료!');
console.log('');
console.log('사용 가능한 도구:');
console.log('  - 38개 MCP 도구 (@su-record/hi-ai 기반)');
console.log('  - 코드 분석, 품질 검증, UI 미리보기 등');
console.log('');
console.log('확인 방법:');
console.log('  Claude Code:  claude mcp list');
console.log('  Cursor:       .cursor/mcp.json');
console.log('  Gemini CLI:   .gemini/settings.json');
console.log('  Antigravity:  .idx/mcp.json');
console.log('');
