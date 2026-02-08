/**
 * IMessageFormatter - Format responses for iMessage
 * Phase 4: External Interface
 *
 * Strips Markdown formatting and splits long messages.
 * iMessage doesn't support Markdown, so we convert to plain text.
 */

const MAX_MESSAGE_LENGTH = 2000;

export class IMessageFormatter {
  /** Convert Markdown to plain text for iMessage */
  toPlainText(markdown: string): string {
    let text = markdown;

    // Remove bold markers (**text** or __text__)
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');

    // Remove italic markers (*text* or _text_)
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');

    // Remove strikethrough (~~text~~)
    text = text.replace(/~~([^~]+)~~/g, '$1');

    // Convert links [text](url) to text (url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

    // Remove code block markers (keep content)
    text = text.replace(/```[\w]*\n([\s\S]*?)\n```/g, '$1');
    text = text.replace(/```([\s\S]*?)```/g, '$1');

    // Remove inline code markers
    text = text.replace(/`([^`]+)`/g, '$1');

    // Remove header markers (# ## ###)
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}$/gm, '');

    // Remove blockquote markers
    text = text.replace(/^>\s+/gm, '');

    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }

  /** Split a long message into chunks within iMessage's practical limit */
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
      const splitAt = this.findSplitPoint(remaining, MAX_MESSAGE_LENGTH);
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    return chunks;
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

    // Try to split at sentence boundary
    const period = text.lastIndexOf('. ', maxLength);
    if (period > maxLength * 0.5) return period + 2;

    // Hard split as last resort
    return maxLength;
  }
}
