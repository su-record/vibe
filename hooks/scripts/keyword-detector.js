#!/usr/bin/env node
/**
 * Keyword Detector & Combiner
 * 매직 키워드 감지 및 조합 처리
 */

import { VIBE_PATH, PROJECT_DIR } from './utils.js';

// 매직 키워드 정의
const MAGIC_KEYWORDS = {
  // 지속성 모드 (완료까지 계속)
  ralph: {
    name: 'Ralph Loop',
    description: 'Continue until task is verified complete',
    flags: ['persistence', 'verification'],
    output: '[RALPH MODE] Self-referential completion loop activated. Will continue until ALL tasks verified complete. NO early stopping.',
  },

  // 울트라워크 모드 (병렬 + 자동 계속)
  ultrawork: {
    name: 'Ultrawork',
    description: 'Maximum parallel execution, no pause',
    flags: ['parallel', 'auto_continue', 'no_confirmation'],
    output: '[ULTRAWORK MODE] Use PARALLEL Task calls. Auto-continue through ALL phases. Auto-retry on errors up to 3 times. Do NOT ask for confirmation between phases.',
  },
  ulw: {
    alias: 'ultrawork',
  },
  울트라워크: {
    alias: 'ultrawork',
  },

  // 계획 모드
  plan: {
    name: 'Plan Mode',
    description: 'Planning interview mode',
    flags: ['planning', 'interview'],
    output: '[PLAN MODE] Enter planning interview mode. Gather requirements before implementation.',
    strict: true, // 일상어 — 명령 끝 위치 또는 --plan 플래그에서만 (오탐 방지)
  },

  // Ralph + Plan 조합
  ralplan: {
    name: 'Ralph Plan',
    description: 'Iterative planning with persistence',
    flags: ['persistence', 'planning', 'iteration'],
    output: '[RALPLAN MODE] Iterative planning with consensus. Will refine plan until approved, then execute with Ralph persistence.',
  },

  // 검증 모드
  verify: {
    name: 'Verify Mode',
    description: 'Strict verification after each step',
    flags: ['verification', 'strict'],
    output: '[VERIFY MODE] Strict verification enabled. Every change must be verified before proceeding.',
    strict: true, // 일상어 ("please verify the fix" 오탐 방지)
  },

  // 탐색 모드
  explore: {
    name: 'Explore Mode',
    description: 'Deep codebase exploration',
    flags: ['exploration', 'thorough'],
    output: '[EXPLORE MODE] Deep exploration enabled. Use multiple Explore agents for thorough codebase analysis.',
    strict: true, // 일상어 ("let me explore the options" 오탐 방지)
  },

  // 빠른 모드
  quick: {
    name: 'Quick Mode',
    description: 'Fast execution, minimal verification',
    flags: ['fast', 'minimal_verification'],
    output: '[QUICK MODE] Fast execution mode. Minimal verification, single round reviews.',
    strict: true, // 일상어 ("quick question on auth" 오탐 방지)
  },
};

// 키워드 조합 시너지
const KEYWORD_SYNERGIES = {
  'ralph+ultrawork': {
    name: 'Ralph Ultrawork',
    output: '[RALPH+ULTRAWORK] Maximum persistence AND parallel execution. Will NOT stop until ALL phases complete with verification.',
  },
  'ralph+verify': {
    name: 'Ralph Verify',
    output: '[RALPH+VERIFY] Persistent completion with strict verification at each step.',
  },
  'ultrawork+explore': {
    name: 'Ultrawork Explore',
    output: '[ULTRAWORK+EXPLORE] Parallel exploration agents for maximum coverage.',
  },
};

/**
 * 텍스트에서 키워드 추출
 */
function detectKeywords(text) {
  const lowerText = text.toLowerCase();
  const detected = [];
  const resolvedKeywords = new Map();

  for (const [keyword, config] of Object.entries(MAGIC_KEYWORDS)) {
    // alias는 본체의 strict 설정을 따른다.
    const target = config.alias ? MAGIC_KEYWORDS[config.alias] : config;
    // strict 키워드(일상어: quick/plan/verify/explore)는 단어경계만으로는
    // "quick question", "please verify" 등에 오탐한다. 따라서
    //   ① 명령 끝 위치의 독립 토큰 ("... 만들어줘 quick")  또는
    //   ② 명시 플래그 ("--quick", "-quick", "/quick")
    // 에서만 매칭한다. 조어(ralph/ultrawork)는 오탐이 거의 없어 단어경계 유지.
    const regex = target.strict
      ? new RegExp(`(?:(?:^|\\s)--?${keyword}\\b)|(?:(?:^|\\s)${keyword}\\s*$)`, 'i')
      : new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(lowerText)) {
      // alias 해결
      const resolved = config.alias ? MAGIC_KEYWORDS[config.alias] : config;
      const resolvedName = config.alias || keyword;

      if (!resolvedKeywords.has(resolvedName)) {
        resolvedKeywords.set(resolvedName, resolved);
        detected.push({
          keyword: resolvedName,
          original: keyword,
          ...resolved,
        });
      }
    }
  }

  return detected;
}

/**
 * 키워드 조합 처리
 */
function processCombinations(detected) {
  if (detected.length <= 1) {
    return null;
  }

  // 키워드 이름 정렬하여 조합 키 생성
  const keywordNames = detected.map(d => d.keyword).sort();

  // 모든 2-조합 확인
  for (let i = 0; i < keywordNames.length; i++) {
    for (let j = i + 1; j < keywordNames.length; j++) {
      const comboKey = `${keywordNames[i]}+${keywordNames[j]}`;
      if (KEYWORD_SYNERGIES[comboKey]) {
        return KEYWORD_SYNERGIES[comboKey];
      }
    }
  }

  return null;
}

/**
 * 모든 플래그 수집
 */
function collectFlags(detected) {
  const flags = new Set();
  for (const d of detected) {
    if (d.flags) {
      d.flags.forEach(f => flags.add(f));
    }
  }
  return Array.from(flags);
}

/**
 * 출력 생성
 */
function generateOutput(detected, combination) {
  const outputs = [];

  // 시너지 조합 우선
  if (combination) {
    outputs.push(combination.output);
  } else {
    // 개별 키워드 출력
    for (const d of detected) {
      if (d.output) {
        outputs.push(d.output);
      }
    }
  }

  // 모든 플래그 수집
  const flags = collectFlags(detected);
  if (flags.length > 0) {
    outputs.push(`[FLAGS] ${flags.join(', ')}`);
  }

  return outputs.join('\n');
}

// 메인 실행
const input = process.argv.slice(2).join(' ') || process.env.USER_PROMPT || '';

if (!input) {
  console.log(`
VIBE Keyword Detector

Available magic keywords:
${Object.entries(MAGIC_KEYWORDS)
  .filter(([_, v]) => !v.alias)
  .map(([k, v]) => `  ${k.padEnd(12)} - ${v.description}`)
  .join('\n')}

Keyword combinations:
${Object.entries(KEYWORD_SYNERGIES)
  .map(([k, v]) => `  ${k.padEnd(20)} - ${v.name}`)
  .join('\n')}

Usage:
  node keyword-detector.js "implement login ralph ultrawork"
  `);
  process.exit(0);
}

const detected = detectKeywords(input);

if (detected.length > 0) {
  const combination = processCombinations(detected);
  const output = generateOutput(detected, combination);
  console.log(output);
}
