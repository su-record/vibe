/**
 * vibe setup - Interactive Setup Wizard
 * LLM 인증 + Priority 설정 + 프로젝트 초기화를 한 번에 처리
 */

import fs from 'fs';
import path from 'path';
import type { Interface } from 'node:readline/promises';
import { createPromptSession, chooseOption, confirm, askNonEmpty, type MenuOption } from '../prompt.js';
import { getLLMAuthStatus, formatAuthMethods } from '../auth.js';
import { gptAuthCore } from '../llm/gpt-commands.js';
import { geminiAuthCore, geminiImportCore } from '../llm/gemini-commands.js';
import { setupExternalLLM } from '../llm/config.js';
import { setEmbeddingPriority, setKimiPriority } from '../llm/priority-commands.js';
import type { LLMStatusMap } from '../types.js';
import { init } from './init.js';

/**
 * 현재 인증 상태 표시
 */
function showCurrentStatus(status: LLMStatusMap): void {
  console.log('Current LLM Status:');
  console.log(`  GPT:    ${formatAuthMethods(status.gpt)}`);
  console.log(`  Gemini: ${formatAuthMethods(status.gemini)}`);
  console.log(`  AZ:     ${formatAuthMethods(status.az)}`);
  console.log(`  Kimi:   ${formatAuthMethods(status.kimi)}`);
}

/**
 * GPT provider 설정 단계
 */
async function setupGpt(rl: Interface, status: LLMStatusMap): Promise<void> {
  console.log('\n--- Step 1/5: GPT ---');
  console.log('GPT provides architecture analysis and debugging.');

  const configured = status.gpt.length > 0;
  if (configured) console.log(`Current: ${formatAuthMethods(status.gpt)}`);

  const options: MenuOption[] = configured
    ? [{ label: 'Reconfigure (OAuth)', value: 'oauth' },
       { label: 'Reconfigure (API Key)', value: 'apikey' },
       { label: 'Keep current', value: 'skip' }]
    : [{ label: 'OAuth (ChatGPT Plus/Pro - opens browser)', value: 'oauth' },
       { label: 'API Key (platform.openai.com/api-keys)', value: 'apikey' },
       { label: 'Skip', value: 'skip' }];

  const choice = await chooseOption(rl, '', options, options.length - 1);

  if (choice === 'oauth') {
    await gptAuthCore();
  } else if (choice === 'apikey') {
    const key = await askNonEmpty(rl, 'Enter GPT API key: ');
    setupExternalLLM('gpt', key);
  } else {
    console.log('GPT: skipped.');
  }
}

/**
 * Gemini provider 설정 단계
 */
async function setupGemini(rl: Interface, status: LLMStatusMap): Promise<void> {
  console.log('\n--- Step 2/5: Gemini ---');
  console.log('Gemini provides UI/UX analysis and web search.');

  const configured = status.gemini.length > 0;
  if (configured) console.log(`Current: ${formatAuthMethods(status.gemini)}`);

  const options: MenuOption[] = configured
    ? [{ label: 'Reconfigure (OAuth)', value: 'oauth' },
       { label: 'Reconfigure (API Key)', value: 'apikey' },
       { label: 'Import from Gemini CLI', value: 'import' },
       { label: 'Keep current', value: 'skip' }]
    : [{ label: 'OAuth (Google account - opens browser)', value: 'oauth' },
       { label: 'API Key (aistudio.google.com/apikey)', value: 'apikey' },
       { label: 'Import from Gemini CLI', value: 'import' },
       { label: 'Skip', value: 'skip' }];

  const choice = await chooseOption(rl, '', options, options.length - 1);

  if (choice === 'oauth') {
    await geminiAuthCore();
  } else if (choice === 'apikey') {
    const key = await askNonEmpty(rl, 'Enter Gemini API key: ');
    setupExternalLLM('gemini', key);
  } else if (choice === 'import') {
    geminiImportCore();
  } else {
    console.log('Gemini: skipped.');
  }
}

/**
 * AZ provider 설정 단계
 */
async function setupAz(rl: Interface, status: LLMStatusMap): Promise<void> {
  console.log('\n--- Step 3/5: AZ (Azure Foundry) ---');
  console.log('AZ provides Kimi K2.5 via Azure Foundry + embedding.');

  const configured = status.az.length > 0;
  if (configured) console.log(`Current: ${formatAuthMethods(status.az)}`);

  const options: MenuOption[] = configured
    ? [{ label: 'Reconfigure (API Key)', value: 'apikey' },
       { label: 'Keep current', value: 'skip' }]
    : [{ label: 'API Key', value: 'apikey' },
       { label: 'Skip', value: 'skip' }];

  const choice = await chooseOption(rl, '', options, options.length - 1);

  if (choice === 'apikey') {
    const key = await askNonEmpty(rl, 'Enter AZ API key: ');
    setupExternalLLM('az', key);
  } else {
    console.log('AZ: skipped.');
  }
}

/**
 * Kimi Direct provider 설정 단계
 */
async function setupKimi(rl: Interface, status: LLMStatusMap): Promise<void> {
  console.log('\n--- Step 4/5: Kimi Direct (Moonshot) ---');
  console.log('Kimi provides direct Kimi K2.5 access via Moonshot API.');

  const configured = status.kimi.length > 0;
  if (configured) console.log(`Current: ${formatAuthMethods(status.kimi)}`);

  const options: MenuOption[] = configured
    ? [{ label: 'Reconfigure (API Key)', value: 'apikey' },
       { label: 'Keep current', value: 'skip' }]
    : [{ label: 'API Key (platform.moonshot.ai)', value: 'apikey' },
       { label: 'Skip', value: 'skip' }];

  const choice = await chooseOption(rl, '', options, options.length - 1);

  if (choice === 'apikey') {
    const key = await askNonEmpty(rl, 'Enter Kimi API key: ');
    setupExternalLLM('kimi', key);
  } else {
    console.log('Kimi: skipped.');
  }
}

/**
 * Provider priority 설정 단계
 */
async function setupPriorities(rl: Interface): Promise<void> {
  console.log('\n--- Step 5/5: Provider Priorities ---');

  const embeddingChoice = await chooseOption(rl, 'Embedding priority (for vector search):', [
    { label: 'AZ first, GPT fallback', value: 'az,gpt' },
    { label: 'GPT first, AZ fallback', value: 'gpt,az' },
    { label: 'Skip (keep default)', value: 'skip' },
  ], 2);

  if (embeddingChoice !== 'skip') {
    setEmbeddingPriority(embeddingChoice);
  }

  const kimiChoice = await chooseOption(rl, 'Kimi chat priority:', [
    { label: 'AZ first, Kimi fallback', value: 'az,kimi' },
    { label: 'Kimi first, AZ fallback', value: 'kimi,az' },
    { label: 'Skip (keep default)', value: 'skip' },
  ], 2);

  if (kimiChoice !== 'skip') {
    setKimiPriority(kimiChoice);
  }
}

/**
 * 프로젝트 초기화 처리
 */
async function handleProjectInit(rl: Interface): Promise<void> {
  const coreDir = path.join(process.cwd(), '.claude', 'vibe');

  if (fs.existsSync(coreDir)) {
    console.log('\nProject already initialized. Skipping init.');
    return;
  }

  console.log('');
  const shouldInit = await confirm(rl, 'Initialize VIBE in current directory?', true);
  if (shouldInit) {
    init();
  }
}

/**
 * 최종 설정 결과 표시
 */
function showSummary(status: LLMStatusMap): void {
  console.log('\n=== Setup Complete ===\n');
  console.log(`  GPT:    ${formatAuthMethods(status.gpt)}`);
  console.log(`  Gemini: ${formatAuthMethods(status.gemini)}`);
  console.log(`  AZ:     ${formatAuthMethods(status.az)}`);
  console.log(`  Kimi:   ${formatAuthMethods(status.kimi)}`);
  console.log('\nRun /vibe.spec "feature" to start!');
}

/**
 * vibe setup 메인 엔트리포인트
 */
export async function setup(): Promise<void> {
  const rl = createPromptSession();

  try {
    console.log('\n=== VIBE Setup Wizard ===\n');

    const status = getLLMAuthStatus();
    showCurrentStatus(status);

    await setupGpt(rl, status);
    await setupGemini(rl, status);
    await setupAz(rl, status);
    await setupKimi(rl, status);
    await setupPriorities(rl);
    await handleProjectInit(rl);

    const finalStatus = getLLMAuthStatus();
    showSummary(finalStatus);
  } finally {
    rl.close();
  }
}
