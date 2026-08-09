/**
 * 사람 판단 게이트 — 대기 중인 질문을 디스크에 남긴다.
 *
 * 배경: vibe 의 사람 개입 지점(SPEC 승인 · stuck 질문 · 비용 게이트)은 전부
 * 모델이 그 자리에서 만들어 출력하는 텍스트였다. 세션이 죽거나 컨텍스트가
 * 압축되면 **무엇을 묻고 있었는지가 사라진다** — 사람은 돌아왔는데 답할 대상이
 * 없다. run-ledger·loop-history·인박스가 전부 디스크에 사는데 정작 "지금 사람을
 * 기다리는 이유"만 컨텍스트에 살고 있었다.
 *
 * 게이트는 **모호한 상태가 아니라 구체적 질문**을 담는다. "승인 대기" 는 게이트가
 * 아니다 — 무엇을 묻는지, 어떤 선택지가 있는지, 답이 무엇을 바꾸는지가 있어야
 * 다음 턴(또는 다음 사람)이 이어받을 수 있다.
 *
 * 저장: `.vibe/gates/<id>.json` — 파일 하나가 게이트 하나. 동시에 여러 루프가
 * 게이트를 열어도 서로 덮어쓰지 않는다.
 *
 * fail-open — 기록 실패가 루프를 멈추지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { projectVibePath, projectVibePathPreferred } from '../utils.js';

/** 읽기용 게이트 디렉토리 (레거시 인식) */
export function gatesDir(projectDir) {
  return projectVibePath(projectDir, 'gates');
}

/** 쓰기용 게이트 디렉토리 — 항상 신규 레이아웃 */
function gatesWriteDir(projectDir) {
  return projectVibePathPreferred(projectDir, 'gates');
}

/** 파일명에 쓸 수 있는 형태로 정규화 — 경로 이탈 방지 */
function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
}

/**
 * 게이트를 연다.
 *
 * @param {string} projectDir
 * @param {{
 *   id: string,
 *   question: string,
 *   options?: string[],
 *   kind?: 'spec-approval'|'stuck'|'cost'|'other',
 *   context?: Record<string, unknown>,
 *   at: string,
 * }} gate - `at` 은 호출자가 넘긴다 (이 모듈은 시각을 읽지 않는다 — 테스트 결정성)
 * @returns {string|null} 기록된 파일 경로, 실패 시 null
 */
export function openGate(projectDir, gate) {
  try {
    if (!gate?.id || !gate?.question || !gate?.at) return null;
    // 구체적 질문이 아니면 게이트가 아니다 — 빈 질문·모호한 상태 문구를 거른다
    if (gate.question.trim().length < 5) return null;

    const dir = gatesWriteDir(projectDir);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${safeId(gate.id)}.json`);

    const record = {
      id: gate.id,
      kind: gate.kind ?? 'other',
      question: gate.question,
      options: Array.isArray(gate.options) ? gate.options : [],
      context: gate.context ?? {},
      status: 'open',
      openedAt: gate.at,
    };
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf-8');
    return file;
  } catch {
    return null;
  }
}

/** 게이트 파일 하나를 읽는다. 손상된 파일은 무시한다. */
function readGate(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 열려 있는 게이트 목록 — 오래된 것부터.
 * @returns {Array<object>}
 */
export function listOpenGates(projectDir) {
  try {
    const dir = gatesDir(projectDir);
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => readGate(path.join(dir, f)))
      .filter(g => g && g.status === 'open')
      .sort((a, b) => String(a.openedAt).localeCompare(String(b.openedAt)));
  } catch {
    return [];
  }
}

/**
 * 게이트에 답한다 — 파일은 남기고 status 만 바꾼다.
 * 지우지 않는 이유: 무엇을 물었고 무엇으로 답했는지가 증거다.
 *
 * @returns {boolean} 성공 여부
 */
export function answerGate(projectDir, id, answer, at) {
  try {
    if (!id || !answer || !at) return false;
    const file = path.join(gatesDir(projectDir), `${safeId(id)}.json`);
    const gate = readGate(file);
    if (!gate || gate.status !== 'open') return false;

    fs.writeFileSync(
      file,
      JSON.stringify({ ...gate, status: 'answered', answer, answeredAt: at }, null, 2) + '\n',
      'utf-8',
    );
    return true;
  } catch {
    return false;
  }
}

/** 사람이 읽는 요약 — 스킬이 그대로 출력한다 */
export function formatOpenGates(gates) {
  if (gates.length === 0) return '열린 게이트 없음';
  return gates.map(g => {
    const opts = g.options.length > 0
      ? '\n' + g.options.map((o, i) => `     [${i + 1}] ${o}`).join('\n')
      : '';
    return `⏸️ ${g.id} (${g.kind}, ${g.openedAt})\n   ${g.question}${opts}`;
  }).join('\n\n');
}
