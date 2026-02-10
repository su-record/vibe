/**
 * Notification Hook - 컨텍스트 자동 저장 (80/90/95%) + 세션 요약 + Reflection
 * Usage: node context-save.js <urgency>
 *   urgency: medium | high | critical
 */
import { getToolsBaseUrl, getLibBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();
const LIB_URL = getLibBaseUrl();

const urgency = process.argv[2] || 'medium';
const summaryMap = {
  medium: 'Context at 80% - auto checkpoint',
  high: 'Context at 90% - save before overflow',
  critical: 'Context at 95% - CRITICAL save before session end',
};

// Debounce: track last reflection level per session to avoid duplicates
let lastReflectionLevel = null;

async function main() {
  try {
    const module = await import(`${BASE_URL}memory/index.js`);
    const result = await module.autoSaveContext({
      urgency,
      contextType: 'progress',
      summary: summaryMap[urgency] || summaryMap.medium,
      projectPath: PROJECT_DIR,
    });
    const percent = urgency === 'critical' ? '95' : urgency === 'high' ? '90' : '80';
    console.log(`[CONTEXT ${percent}%]`, result.content[0].text);
  } catch {
    // 무시
  }

  // Minor Reflection (80% = medium): 컨텍스트 압력 시 자동 성찰
  if (urgency === 'medium' && lastReflectionLevel !== 'medium') {
    lastReflectionLevel = 'medium';
    // Fire-and-forget: 기존 context-save에 영향 없음
    setImmediate(() => {
      triggerMinorReflection().catch(e => {
        process.stderr.write(`[REFLECTION] minor reflection failed: ${e.message}\n`);
      });
    });
  }

  // Critical (95%): 세션 요약 자동 생성 + Major Reflection
  if (urgency === 'critical') {
    try {
      const { SessionSummarizer } = await import(`${BASE_URL}../lib/memory/SessionSummarizer.js`);
      const { MemoryStorage } = await import(`${BASE_URL}../lib/memory/MemoryStorage.js`);

      const storage = new MemoryStorage(PROJECT_DIR);
      const summarizer = new SessionSummarizer(storage);

      const sessionId = `session_${Date.now()}`;
      const summaryInput = summarizer.generateSummaryFromObservations(sessionId);
      if (summaryInput.learned || summaryInput.completed) {
        summarizer.saveSummary(summaryInput);
        console.log('[SESSION SUMMARY] Auto-generated from observations');
      }
    } catch {
      // 세션 요약 생성 실패해도 무시
    }

    // Major Reflection: 세션 종료 시 전체 성찰
    if (lastReflectionLevel !== 'critical') {
      lastReflectionLevel = 'critical';
      setImmediate(() => {
        triggerMajorReflection().catch(e => {
          process.stderr.write(`[REFLECTION] major reflection failed: ${e.message}\n`);
        });
      });
    }
  }
}

/**
 * Minor Reflection: 컨텍스트 압력 시 현재 세션 상태 저장 (< 200ms)
 */
async function triggerMinorReflection() {
  try {
    const { MemoryManager } = await import(`${LIB_URL}MemoryManager.js`);
    const mm = MemoryManager.getInstance(PROJECT_DIR);

    // 현재 세션의 활성 컨텍스트 수집
    const activeCtx = mm.retrieveActiveContext();
    const insights = [];
    const decisions = [];
    const patterns = [];

    // 활성 Goals에서 insights 추출
    if (activeCtx.goals?.length > 0) {
      for (const goal of activeCtx.goals.slice(0, 5)) {
        insights.push(`Goal: ${goal.title} (${goal.progressPercent || 0}%)`);
      }
    }

    // 최근 Decisions에서 결정사항 추출
    if (activeCtx.decisions?.length > 0) {
      for (const decision of activeCtx.decisions.slice(0, 5)) {
        decisions.push(`${decision.title}${decision.rationale ? ': ' + decision.rationale : ''}`);
      }
    }

    // 최근 Constraints에서 패턴 추출
    if (activeCtx.constraints?.length > 0) {
      for (const constraint of activeCtx.constraints.slice(0, 3)) {
        patterns.push(`Constraint: ${constraint.title}`);
      }
    }

    if (insights.length === 0 && decisions.length === 0 && patterns.length === 0) {
      return; // 저장할 내용 없으면 스킵
    }

    const store = mm.getReflectionStore();
    store.save({
      type: 'minor',
      trigger: 'context_pressure',
      insights,
      decisions,
      patterns,
      score: 0.5,
      sessionId: `session_${Date.now()}`,
    });
  } catch {
    // Silent fail — 기존 context-save에 영향 없음
  }
}

/**
 * Major Reflection: 세션 종료 시 전체 성찰 (< 500ms)
 */
async function triggerMajorReflection() {
  try {
    const { MemoryManager } = await import(`${LIB_URL}MemoryManager.js`);
    const mm = MemoryManager.getInstance(PROJECT_DIR);

    const activeCtx = mm.retrieveActiveContext();
    const recentObs = mm.getRecentObservations(10);

    const insights = [];
    const decisions = [];
    const patterns = [];
    const filesContext = [];

    // 완료된 목표
    if (activeCtx.goals?.length > 0) {
      const completed = activeCtx.goals.filter(g => g.status === 'completed');
      const inProgress = activeCtx.goals.filter(g => g.status === 'active' || g.status === 'in_progress');
      if (completed.length > 0) {
        insights.push(`Completed goals: ${completed.map(g => g.title).join(', ')}`);
      }
      if (inProgress.length > 0) {
        insights.push(`In-progress goals: ${inProgress.map(g => `${g.title} (${g.progressPercent || 0}%)`).join(', ')}`);
      }
    }

    // 결정사항
    if (activeCtx.decisions?.length > 0) {
      for (const d of activeCtx.decisions.slice(0, 5)) {
        decisions.push(d.title + (d.rationale ? ` — ${d.rationale}` : ''));
      }
    }

    // 관찰에서 패턴/파일 추출
    if (recentObs.length > 0) {
      for (const obs of recentObs) {
        if (obs.type === 'discovery' || obs.type === 'bugfix') {
          patterns.push(`[${obs.type}] ${obs.title}`);
        }
        if (obs.filesModified?.length > 0) {
          filesContext.push(...obs.filesModified);
        }
      }
    }

    // 중복 제거
    const uniqueFiles = [...new Set(filesContext)].slice(0, 20);

    const score = Math.min(1.0, 0.5 + (insights.length * 0.1) + (decisions.length * 0.05));

    const store = mm.getReflectionStore();
    store.save({
      type: 'major',
      trigger: 'session_end',
      insights,
      decisions,
      patterns,
      filesContext: uniqueFiles,
      score,
      sessionId: `session_${Date.now()}`,
    });
  } catch {
    // Silent fail
  }
}

main();
