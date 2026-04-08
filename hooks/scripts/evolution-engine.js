/**
 * PostToolUse Hook - Evolution Engine
 * Write/Edit 이벤트 후 인사이트 추출 및 자동 생성 파이프라인 트리거
 */
import { getLibBaseUrl, PROJECT_DIR } from './utils.js';
import fs from 'fs';
import path from 'path';

async function main() {
  // Evolution 활성화 여부 확인
  const configPath = path.join(PROJECT_DIR, '.claude', 'vibe', 'config.json');
  let config = { mode: 'suggest', enabled: false };

  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = {
        mode: raw.evolution?.mode || 'suggest',
        enabled: raw.evolution?.enabled === true,
      };
    }
  } catch { /* ignore */ }

  if (!config.enabled) return;

  // 비동기로 파이프라인 실행 (메인 훅 흐름 차단 안 함)
  setImmediate(async () => {
    try {
      const LIB_BASE = getLibBaseUrl();
      const [memMod, extractorMod, orchestratorMod] = await Promise.all([
        import(`${LIB_BASE}memory/MemoryStorage.js`),
        import(`${LIB_BASE}evolution/InsightExtractor.js`),
        import(`${LIB_BASE}evolution/EvolutionOrchestrator.js`),
      ]);

      const storage = new memMod.MemoryStorage(PROJECT_DIR);

      // Phase 2: 인사이트 추출
      const extractor = new extractorMod.InsightExtractor(storage);
      const extractResult = extractor.extractFromRecent(20);

      // Phase 2b: Guard trace 분석 (하네스 자기 개선)
      let guardInsightCount = 0;
      try {
        const guardMod = await import(`${LIB_BASE}evolution/GuardAnalyzer.js`);
        const insightMod = await import(`${LIB_BASE}evolution/InsightStore.js`);
        const insightStore = new insightMod.InsightStore(storage);
        const guardAnalyzer = new guardMod.GuardAnalyzer(insightStore);
        const guardResult = guardAnalyzer.analyze(7);
        guardInsightCount = guardResult.newInsights.length;
        if (guardInsightCount > 0) {
          process.stderr.write(
            `[Evolution] Guard analysis: ${guardInsightCount} new insights from hook traces\n`
          );
        }
      } catch (e) {
        process.stderr.write(`[Evolution] Guard analysis skipped: ${e.message}\n`);
      }

      if (
        extractResult.newInsights.length === 0 &&
        extractResult.mergedInsights.length === 0 &&
        guardInsightCount === 0
      ) {
        storage.close();
        return;
      }

      // Phase 3: config.mode에 따라 생성
      if (config.mode === 'suggest' || config.mode === 'auto') {
        const orchestrator = new orchestratorMod.EvolutionOrchestrator(storage, {
          mode: config.mode,
        });
        const genResult = orchestrator.generate();

        if (genResult.generated.length > 0) {
          const label = config.mode === 'auto' ? 'auto-generated' : 'suggested';
          process.stderr.write(
            `[Evolution] ${genResult.generated.length} artifacts ${label}\n`
          );
        }
      }

      storage.close();
    } catch (e) {
      process.stderr.write(`[Evolution] Engine error: ${e.message}\n`);
    }
  });
}

main();
