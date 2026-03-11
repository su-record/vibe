/**
 * PostToolUse Hook - Write/Edit 후 코드 품질 검사 + 관찰 자동 캡처
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

/**
 * stdin에서 hook input JSON을 읽어 파일 경로 추출
 */
function getModifiedFiles() {
  try {
    const input = process.env.HOOK_INPUT;
    if (input) {
      const parsed = JSON.parse(input);
      const filePath = parsed.tool_input?.file_path || parsed.tool_input?.path;
      return filePath ? [filePath] : [];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * 파일 확장자/경로로 관찰 타입 분류
 */
function classifyObservation(files) {
  const hasTest = files.some(f => /\.(test|spec)\.[jt]sx?$/.test(f) || /\/__tests__\//.test(f));
  const hasConfig = files.some(f => /\.(json|ya?ml|toml|env|config)/.test(f));

  if (hasTest) return { type: 'feature', title: 'Test file updated' };
  if (hasConfig) return { type: 'refactor', title: 'Configuration updated' };
  return { type: 'feature', title: 'Code modified' };
}

async function main() {
  // 1. 코드 품질 검사 (변경된 파일만 — 전체 프로젝트 스캔 금지)
  try {
    const files = getModifiedFiles();
    if (files.length > 0) {
      const module = await import(`${BASE_URL}convention/index.js`);
      const result = await module.validateCodeQuality({
        targetPath: files[0],
        projectPath: PROJECT_DIR,
      });
      const text = result.content[0].text;
      // P1/P2만 출력 — P3(스타일) 무시
      const critical = text.split('\n').filter(l => /\b(error|critical|P1|P2)\b/i.test(l)).slice(0, 3);
      if (critical.length > 0) {
        console.log('[CODE CHECK]', critical.join(' | '));
      }
    }
  } catch {
    // 검사 실패 시 조용히 계속 — 진행 차단 금지
  }

  // 2. 관찰 자동 캡처
  try {
    const files = getModifiedFiles();
    if (files.length === 0) return;

    const memModule = await import(`${BASE_URL}memory/index.js`);
    const { type, title } = classifyObservation(files);

    await memModule.addObservation({
      type,
      title: `${title}: ${files.map(f => f.split(/[\\/]/).pop()).join(', ')}`,
      filesModified: files,
      projectPath: PROJECT_DIR,
    });
  } catch {
    // 관찰 캡처 실패해도 무시 (non-critical)
  }
}

main();
