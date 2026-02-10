/**
 * Provider 우선순위 설정 CLI 명령어
 */

import {
  loadPriorityConfig,
  savePriorityConfig,
  type EmbeddingProvider,
  type KimiProvider,
} from '../../core/lib/priority-config.js';

/**
 * 임베딩 우선순위 설정
 * @param input - "az,gpt" 또는 "gpt,az"
 */
export function setEmbeddingPriority(input: string): void {
  if (!input) {
    console.log(`
Usage: vibe config embedding-priority <priority>

Examples:
  vibe config embedding-priority az,gpt    # AZ first, GPT fallback
  vibe config embedding-priority gpt,az    # GPT first, AZ fallback
    `);
    return;
  }

  const providers = input.split(',').map(s => s.trim()) as EmbeddingProvider[];
  const valid = providers.every(p => p === 'az' || p === 'gpt');

  if (!valid || providers.length === 0) {
    console.log('Invalid providers. Use: az, gpt');
    return;
  }

  savePriorityConfig({ embedding: providers });
  console.log(`✅ Embedding priority set: ${providers.join(' → ')}`);
}

/**
 * Kimi 채팅 우선순위 설정
 * @param input - "az,kimi" 또는 "kimi,az"
 */
export function setKimiPriority(input: string): void {
  if (!input) {
    console.log(`
Usage: vibe config kimi-priority <priority>

Examples:
  vibe config kimi-priority az,kimi    # Azure Foundry first, Moonshot fallback
  vibe config kimi-priority kimi,az    # Moonshot first, Azure Foundry fallback
    `);
    return;
  }

  const providers = input.split(',').map(s => s.trim()) as KimiProvider[];
  const valid = providers.every(p => p === 'az' || p === 'kimi');

  if (!valid || providers.length === 0) {
    console.log('Invalid providers. Use: az, kimi');
    return;
  }

  savePriorityConfig({ kimi: providers });
  console.log(`✅ Kimi chat priority set: ${providers.join(' → ')}`);
}

/**
 * 현재 우선순위 설정 표시
 */
export function showPriorityConfig(): void {
  const config = loadPriorityConfig();

  console.log(`
📊 Provider Priority Configuration

Embedding:  ${config.embedding.join(' → ')}
Kimi Chat:  ${config.kimi.join(' → ')}

Change:
  vibe config embedding-priority gpt,az
  vibe config kimi-priority kimi,az
  `);
}
