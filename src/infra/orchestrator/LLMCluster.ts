/**
 * LLMCluster - Multi-LLM 병렬 쿼리 및 상태 관리
 * GPT, Antigravity, Claude 지원
 */

import { execSync } from 'child_process';
import * as gptApi from '../lib/gpt/index.js';
import * as antigravityApi from '../lib/antigravity/index.js';
import { warnLog } from '../lib/utils.js';

/**
 * Multi-LLM 쿼리 결과
 */
export interface MultiLlmQueryResult {
  gpt?: string;
  antigravity?: string;
  claude?: string;
}

/**
 * LLM 상태 결과
 */
export interface LlmStatusResult {
  gpt: { available: boolean };
  antigravity: { available: boolean };
  claude: { available: boolean };
}

/**
 * LLMCluster 설정
 */
export interface LLMClusterOptions {
  defaultSystemPrompt?: string;
}

/**
 * LLMCluster - GPT / Antigravity / Claude 병렬 쿼리 및 상태 관리
 */
export class LLMCluster {
  private defaultSystemPrompt: string;

  constructor(options: LLMClusterOptions = {}) {
    this.defaultSystemPrompt = options.defaultSystemPrompt ?? 'You are a helpful assistant.';
  }

  /**
   * Claude CLI 오케스트레이션 (claude --print)
   */
  async claudeOrchestrate(
    prompt: string,
    systemPrompt?: string,
  ): Promise<string> {
    const sys = systemPrompt ?? this.defaultSystemPrompt;
    const fullPrompt = `[System]\n${sys}\n\n[User]\n${prompt}`;
    // 재귀 가드 — spawn된 자식 claude 세션의 UserPromptSubmit/Stop hook이
    // 다시 외부 LLM/오케스트레이션을 돌리는 fork 폭주를 차단한다.
    // hook 스크립트는 VIBE_HOOK_DEPTH 가 존재하면 즉시 종료한다.
    const result = execSync(
      `claude --print --dangerously-skip-permissions`,
      {
        input: fullPrompt,
        timeout: 180000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, VIBE_HOOK_DEPTH: process.env.VIBE_HOOK_DEPTH ?? '1' },
      }
    );
    return result.trim();
  }

  /**
   * GPT 오케스트레이션
   */
  async gptOrchestrate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return gptApi.coreGptOrchestrate(
      prompt,
      systemPrompt ?? this.defaultSystemPrompt,
      options
    );
  }

  /**
   * Antigravity 오케스트레이션
   */
  async antigravityOrchestrate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return antigravityApi.coreAntigravityOrchestrate(
      prompt,
      systemPrompt ?? this.defaultSystemPrompt,
      options
    );
  }

  /**
   * Antigravity 웹 검색
   */
  async antigravityWebSearch(query: string): Promise<string> {
    return antigravityApi.quickWebSearch(query);
  }

  /**
   * GPT 웹 검색 (Antigravity로 위임)
   * @deprecated GPT Codex API는 웹 검색을 지원하지 않습니다. antigravityWebSearch를 사용하세요.
   */
  async gptWebSearch(query: string): Promise<string> {
    return this.antigravityWebSearch(query);
  }

  /**
   * 멀티 LLM 병렬 쿼리
   */
  async multiQuery(
    prompt: string,
    options?: { useGpt?: boolean; useAntigravity?: boolean; useClaude?: boolean }
  ): Promise<MultiLlmQueryResult> {
    const { useGpt = true, useAntigravity = true, useClaude = false } = options || {};
    const results: MultiLlmQueryResult = {};

    const promises: Promise<void>[] = [];

    if (useGpt) {
      promises.push(
        this.gptOrchestrate(prompt)
          .then(r => { results.gpt = r; })
          .catch(e => { warnLog('GPT query failed in multiLlm', e); })
      );
    }

    if (useAntigravity) {
      promises.push(
        this.antigravityOrchestrate(prompt)
          .then(r => { results.antigravity = r; })
          .catch(e => { warnLog('Antigravity query failed in multiLlm', e); })
      );
    }

    if (useClaude) {
      promises.push(
        this.claudeOrchestrate(prompt)
          .then(r => { results.claude = r; })
          .catch(e => { warnLog('Claude query failed in multiLlm', e); })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * LLM 상태 확인 (전체)
   */
  async checkStatus(): Promise<LlmStatusResult> {
    let gptAvailable = false;
    let antigravityAvailable = false;
    let claudeAvailable = false;

    const promises: Promise<void>[] = [
      this.gptOrchestrate('ping', 'Reply with pong')
        .then(() => { gptAvailable = true; })
        .catch(e => { warnLog('GPT status check failed', e); }),
      this.antigravityOrchestrate('ping', 'Reply with pong')
        .then(() => { antigravityAvailable = true; })
        .catch(e => { warnLog('Antigravity status check failed', e); }),
      this.claudeOrchestrate('ping', 'Reply with pong')
        .then(() => { claudeAvailable = true; })
        .catch(e => { warnLog('Claude status check failed', e); }),
    ];

    await Promise.all(promises);

    return {
      gpt: { available: gptAvailable },
      antigravity: { available: antigravityAvailable },
      claude: { available: claudeAvailable },
    };
  }
}

// 싱글톤 인스턴스
let defaultCluster: LLMCluster | null = null;

export function getLLMCluster(options?: LLMClusterOptions): LLMCluster {
  if (!defaultCluster || options) {
    defaultCluster = new LLMCluster(options);
  }
  return defaultCluster;
}
