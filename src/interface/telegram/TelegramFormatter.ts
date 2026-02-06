/**
 * TelegramFormatter - Format responses for Telegram
 * Phase 4: External Interface
 *
 * Handles 4096-char limit, Markdown formatting, code blocks
 */

const MAX_MESSAGE_LENGTH = 4096;

export class TelegramFormatter {
  /** Split a long message into chunks within Telegram's limit */
  splitMessage(content: string): string[] {
    if (content.length <= MAX_MESSAGE_LENGTH) {
      return [content];
    }

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a natural boundary
      let splitAt = this.findSplitPoint(remaining, MAX_MESSAGE_LENGTH);
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    return chunks;
  }

  /** Format code blocks for Telegram Markdown */
  formatCodeBlock(code: string, language: string = ''): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  /** Format a progress update */
  formatProgress(jobId: string, status: string, progress?: number): string {
    const bar = progress !== undefined ? this.progressBar(progress) : '';
    return `Job \`${jobId}\`\nStatus: ${status}${bar ? '\n' + bar : ''}`;
  }

  /** Format an error message */
  formatError(message: string): string {
    return `Error: ${message}`;
  }

  // ========================================================================
  // Private
  // ========================================================================

  private findSplitPoint(text: string, maxLength: number): number {
    // Try to split at double newline (paragraph)
    const doubleNewline = text.lastIndexOf('\n\n', maxLength);
    if (doubleNewline > maxLength * 0.5) return doubleNewline + 2;

    // Try to split at single newline
    const newline = text.lastIndexOf('\n', maxLength);
    if (newline > maxLength * 0.5) return newline + 1;

    // Try to split at space
    const space = text.lastIndexOf(' ', maxLength);
    if (space > maxLength * 0.5) return space + 1;

    // Hard split
    return maxLength;
  }

  private progressBar(percent: number): string {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
  }
}
