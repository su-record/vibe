import { decodeEntities } from './xml.js';

/** HTML as content: scripts and styles dropped, block tags become line breaks, tables become rows of ` | `. */
export function htmlText(html: string): string {
  let s = html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<\/(td|th)>/gi, ' | ').replace(/<\/(tr|p|div|li|h[1-6]|section|article|header|footer|blockquote|pre|table)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<li\b[^>]*>/gi, '- ').replace(/<[^>]+>/g, '');
  return decodeEntities(s).split('\n').map((l) => l.replace(/\s+/g, ' ').replace(/ \| $/, '').trim()).filter((l, i, all) => l || (i > 0 && all[i - 1])).join('\n').trim();
}
