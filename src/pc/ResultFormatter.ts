/**
 * Result Formatter — Phase 6-2
 *
 * Channel-specific result formatting.
 * Telegram: Markdown + inline image
 * Slack: Block Kit + file upload
 * Voice: Text summary → TTS
 * Web: JSON + Base64 image
 */

import type {
  OutputChannel,
  FormattedResult,
  CommandResult,
  IntegrationLogger,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_SUMMARY_SENTENCES = 3;
const MAX_TEXT_LENGTH = 4000;

// ============================================================================
// Result Formatter
// ============================================================================

export class ResultFormatter {
  private logger: IntegrationLogger;

  constructor(logger: IntegrationLogger) {
    this.logger = logger;
  }

  /** Format command result for the target channel */
  format(result: CommandResult, channel: OutputChannel): FormattedResult {
    if (!result.success) {
      return this.formatError(result, channel);
    }

    switch (channel) {
      case 'telegram':
        return this.formatTelegram(result);
      case 'slack':
        return this.formatSlack(result);
      case 'voice':
        return this.formatVoice(result);
      case 'web':
        return this.formatWeb(result);
      default:
        return this.formatTelegram(result);
    }
  }

  /** Summarize long text to max sentences */
  summarize(text: string): string {
    const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= MAX_SUMMARY_SENTENCES) return text;
    return sentences.slice(0, MAX_SUMMARY_SENTENCES).join('. ').trim() + '.';
  }

  /** Truncate text to max length */
  truncate(text: string, max: number = MAX_TEXT_LENGTH): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 3) + '...';
  }

  // ============================================================================
  // Private: Channel Formatters
  // ============================================================================

  private formatTelegram(result: CommandResult): FormattedResult {
    const text = this.extractText(result);
    return {
      channel: 'telegram',
      text: this.truncate(text),
      markdown: this.truncate(text),
    };
  }

  private formatSlack(result: CommandResult): FormattedResult {
    const text = this.extractText(result);
    return {
      channel: 'slack',
      text: this.truncate(text),
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: this.truncate(text) },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Module: *${result.module}* | ${result.durationMs}ms` },
          ],
        },
      ],
    };
  }

  private formatVoice(result: CommandResult): FormattedResult {
    const text = this.extractText(result);
    const ttsText = this.summarize(text);
    return {
      channel: 'voice',
      text,
      ttsText,
    };
  }

  private formatWeb(result: CommandResult): FormattedResult {
    return {
      channel: 'web',
      text: JSON.stringify(result.data ?? {}, null, 2),
    };
  }

  private formatError(result: CommandResult, channel: OutputChannel): FormattedResult {
    const errorText = result.error ?? '알 수 없는 오류가 발생했습니다.';
    const retryMsg = '잠시 후 다시 시도해주세요.';

    return {
      channel,
      text: `${errorText}\n\n${retryMsg}`,
      ...(channel === 'voice' ? { ttsText: `${errorText} ${retryMsg}` } : {}),
      ...(channel === 'slack' ? {
        blocks: [{
          type: 'section',
          text: { type: 'mrkdwn', text: `:x: ${errorText}\n${retryMsg}` },
        }],
      } : {}),
    };
  }

  private extractText(result: CommandResult): string {
    if (typeof result.data === 'string') return result.data;
    if (result.data && typeof result.data === 'object') {
      const d = result.data as Record<string, unknown>;
      if ('text' in d && typeof d.text === 'string') return d.text;
      if ('message' in d && typeof d.message === 'string') return d.message;
      return JSON.stringify(d, null, 2);
    }
    return `${result.module} 완료 (${result.durationMs}ms)`;
  }
}
