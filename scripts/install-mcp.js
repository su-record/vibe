#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 vibe MCP 서버 설치 중...\n');

// vibe 패키지의 실제 설치 경로 찾기
// npm link인 경우: 로컬 개발 경로
// npm install -g인 경우: 글로벌 설치 경로
// path.dirname()을 사용해 크로스 플랫폼 호환 (Windows/Unix)
const vibePackagePath = path.dirname(__dirname);

// MCP 서버 경로 (hi-ai 패키지)
// path.join()이 자동으로 OS별 경로 구분자 처리
const mcpIndexPath = path.join(vibePackagePath, 'node_modules', '@su-record', 'hi-ai', 'dist', 'index.js');

// hi-ai 설치 확인
if (!fs.existsSync(mcpIndexPath)) {
  console.log('⚠️  hi-ai MCP 서버를 찾을 수 없습니다.');
  console.log('   경로:', mcpIndexPath);
  console.log('   npm install을 실행해주세요.\n');
  console.log('   npm install');
  console.log('');
  process.exit(1);
}

console.log('📍 MCP 서버 경로:', mcpIndexPath);

try {
  // Claude Code에 MCP 서버 등록
  const command = `claude mcp add vibe node "${mcpIndexPath}"`;
  console.log('📝 실행:', command);
  console.log('');

  execSync(command, { stdio: 'inherit' });

  console.log('\n✅ vibe MCP 서버 등록 완료!');
  console.log('');
  console.log('사용 가능한 도구:');
  console.log('  - 38개 MCP 도구 (@su-record/hi-ai 기반)');
  console.log('  - 코드 분석, 품질 검증, UI 미리보기 등');
  console.log('');
  console.log('다음 명령어로 확인:');
  console.log('  claude mcp list');
  console.log('');

} catch (error) {
  // stderr 출력 확인
  const stderrOutput = error.stderr ? error.stderr.toString() : '';
  const stdoutOutput = error.stdout ? error.stdout.toString() : '';
  const fullOutput = error.message + stderrOutput + stdoutOutput;

  // "already exists" 에러는 성공으로 간주
  if (fullOutput.includes('already exists')) {
    console.log('ℹ️  vibe MCP 서버가 이미 등록되어 있습니다.');
    console.log('');
    console.log('다음 명령어로 확인:');
    console.log('  claude mcp list');
    console.log('');
    process.exit(0);
  }

  console.error('❌ MCP 서버 등록 실패');
  console.error('');
  console.error('수동 등록 방법:');
  console.error(`  claude mcp add vibe node "${mcpIndexPath}"`);
  console.error('');
  console.error('에러:', error.message);
  if (stderrOutput) console.error('stderr:', stderrOutput);
  if (stdoutOutput) console.error('stdout:', stdoutOutput);
  process.exit(1);
}
