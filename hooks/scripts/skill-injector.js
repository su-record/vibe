/**
 * SessionStart Hook - Auto-generated skill/agent/rule 주입
 * auto/ 디렉토리를 스캔하여 .disabled가 아닌 파일을 로드하고 사용량 추적
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getLibBaseUrl, PROJECT_DIR } from './utils.js';

const HOME = os.homedir();

// auto/ 디렉토리 경로
const AUTO_DIRS = {
  'user-auto': {
    skills: path.join(HOME, '.claude', 'vibe', 'skills', 'auto'),
    agents: path.join(HOME, '.claude', 'agents', 'auto'),
    rules: path.join(HOME, '.claude', 'vibe', 'rules', 'auto'),
  },
  'project-auto': {
    skills: path.join(PROJECT_DIR, '.claude', 'vibe', 'skills', 'auto'),
    agents: path.join(PROJECT_DIR, '.claude', 'agents', 'auto'),
    rules: path.join(PROJECT_DIR, '.claude', 'vibe', 'rules', 'auto'),
  },
};

/**
 * 디렉토리에서 .md 파일 스캔 (.disabled 제외)
 */
function scanAutoDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.md') && !f.endsWith('.disabled'))
    .map(f => ({
      name: f.replace(/\.md$/, ''),
      path: path.join(dirPath, f),
      content: fs.readFileSync(path.join(dirPath, f), 'utf8'),
    }));
}

async function main() {
  const allSkills = [];

  for (const [source, dirs] of Object.entries(AUTO_DIRS)) {
    for (const [type, dirPath] of Object.entries(dirs)) {
      const files = scanAutoDir(dirPath);
      for (const file of files) {
        allSkills.push({ ...file, source, type, generated: true });
      }
    }
  }

  if (allSkills.length === 0) return;

  // 사용량 추적
  try {
    const LIB_BASE = getLibBaseUrl();
    const [memMod, trackerMod] = await Promise.all([
      import(`${LIB_BASE}memory/MemoryStorage.js`),
      import(`${LIB_BASE}evolution/UsageTracker.js`),
    ]);

    const storage = new memMod.MemoryStorage(PROJECT_DIR);
    const tracker = new trackerMod.UsageTracker(storage);

    for (const skill of allSkills) {
      tracker.recordUsage({
        generationId: skill.name,
        event: 'injected',
        metadata: { source: skill.source, type: skill.type, generated: skill.generated },
      });
    }

    storage.close();
  } catch {
    // 추적 실패해도 주입은 계속
  }

  const summary = allSkills.map(s => `${s.source}/${s.type}/${s.name}`).join(', ');
  process.stderr.write(`[Evolution] Injected ${allSkills.length} auto skills: ${summary}\n`);
}

main();
