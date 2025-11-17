#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 vide MCP 서버 설치 중...\n');

// MCP 서버 경로 (npm 글로벌 설치 위치)
const mcpIndexPath = path.join(__dirname, '../mcp/dist/index.js');

// 상대 경로로 확인 (로컬 개발 시)
if (!fs.existsSync(mcpIndexPath)) {
  console.log('⚠️  MCP 서버를 찾을 수 없습니다.');
  console.log('   경로:', mcpIndexPath);
  console.log('   npm install을 다시 실행해주세요.\n');
  process.exit(1);
}

console.log('📍 MCP 서버 경로:', mcpIndexPath);

try {
  // Claude Code에 MCP 서버 등록
  const command = `claude mcp add vide node "${mcpIndexPath}"`;
  console.log('📝 실행:', command);
  console.log('');

  execSync(command, { stdio: 'inherit' });

  console.log('\n✅ vide MCP 서버 등록 완료!');
  console.log('');
  console.log('사용 가능한 도구:');
  console.log('  - 38개 MCP 도구 (@su-record/hi-ai 기반)');
  console.log('  - 코드 분석, 품질 검증, UI 미리보기 등');
  console.log('');
  console.log('다음 명령어로 확인:');
  console.log('  claude mcp list');
  console.log('');

} catch (error) {
  console.error('❌ MCP 서버 등록 실패');
  console.error('');
  console.error('수동 등록 방법:');
  console.error(`  claude mcp add vide node "${mcpIndexPath}"`);
  console.error('');
  console.error('에러:', error.message);
  process.exit(1);
}
