/**
 * LLMCluster - Multi-LLM 병렬 쿼리 및 상태 관리
 * orchestrator.ts에서 추출된 LLM 클러스터 관리 모듈
 */

import * as gptApi from '../lib/gpt-api.js';
import * as geminiApi from '../lib/gemini-api.js';
import { warnLog } from '../lib/utils.js';

/**
 * Multi-LLM 쿼리 결과
 */
export interface MultiLlmQueryResult {
  gpt?: string;
  gemini?: string;
}

/**
 * LLM 상태 결과
 */
export interface LlmStatusResult {
  gpt: { available: boolean };
  gemini: { available: boolean };
}

/**
 * LLMCluster 설정
 */
export interface LLMClusterOptions {
  defaultSystemPrompt?: string;
}

/**
 * LLMCluster - GPT/Gemini 병렬 쿼리 및 상태 관리
 */
export class LLMCluster {
  private defaultSystemPrompt: string;

  constructor(options: LLMClusterOptions = {}) {
    this.defaultSystemPrompt = options.defaultSystemPrompt ?? 'You are a helpful assistant.';
  }

  /**
   * GPT 오케스트레이션
   */
  async gptOrchestrate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return gptApi.vibeGptOrchestrate(
      prompt,
      systemPrompt ?? this.defaultSystemPrompt,
      options
    );
  }

  /**
   * Gemini 오케스트레이션
   */
  async geminiOrchestrate(
    prompt: string,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<string> {
    return geminiApi.vibeGeminiOrchestrate(
      prompt,
      systemPrompt ?? this.defaultSystemPrompt,
      options
    );
  }

  /**
   * Gemini 웹 검색
   */
  async geminiWebSearch(query: string): Promise<string> {
    return geminiApi.quickWebSearch(query);
  }

  /**
   * GPT 웹 검색 (Gemini로 위임)
   * @deprecated GPT Codex API는 웹 검색을 지원하지 않습니다. geminiWebSearch를 사용하세요.
   */
  async gptWebSearch(query: string): Promise<string> {
    return this.geminiWebSearch(query);
  }

  /**
   * 멀티 LLM 병렬 쿼리
   * GPT, Gemini 동시 호출하여 결과 비교
   */
  async multiQuery(
    prompt: string,
    options?: { useGpt?: boolean; useGemini?: boolean }
  ): Promise<MultiLlmQueryResult> {
    const { useGpt = true, useGemini = true } = options || {};
    const results: MultiLlmQueryResult = {};

    const promises: Promise<void>[] = [];

    if (useGpt) {
      promises.push(
        this.gptOrchestrate(prompt)
          .then(r => { results.gpt = r; })
          .catch(e => { warnLog('GPT query failed in multiLlm', e); })
      );
    }

    if (useGemini) {
      promises.push(
        this.geminiOrchestrate(prompt)
          .then(r => { results.gemini = r; })
          .catch(e => { warnLog('Gemini query failed in multiLlm', e); })
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
    let geminiAvailable = false;

    const promises: Promise<void>[] = [
      this.gptOrchestrate('ping', 'Reply with pong')
        .then(() => { gptAvailable = true; })
        .catch(e => { warnLog('GPT status check failed', e); }),
      this.geminiOrchestrate('ping', 'Reply with pong')
        .then(() => { geminiAvailable = true; })
        .catch(e => { warnLog('Gemini status check failed', e); })
    ];

    await Promise.all(promises);

    return {
      gpt: { available: gptAvailable },
      gemini: { available: geminiAvailable }
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
