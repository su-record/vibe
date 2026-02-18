// Skill Generator for self-evolution Phase 3
// Generates skill markdown files from insights

import { Insight } from '../InsightStore.js';

interface GeneratedSkill {
  name: string;
  content: string;
  triggerPatterns: string[];
}

const FILENAME_REGEX = /^[a-z0-9-]+$/;

function sanitizeName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣 _.,\-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'auto-skill';
}

function sanitizeContent(text: string): string {
  // Remove potential prompt injection patterns (opening and closing tags)
  return text
    .replace(/<\/?role>/gi, '')
    .replace(/<\/?task>/gi, '')
    .replace(/<\/?context>/gi, '')
    .replace(/<\/?constraints>/gi, '')
    .replace(/<\/?output_format>/gi, '')
    .replace(/<\/?acceptance>/gi, '')
    .replace(/[^\x20-\x7E\r\n\t가-힣ㄱ-ㅎㅏ-ㅣ .,!?:;'"()\[\]{}\-_+=@#$%^&*/<>]/g, '');
}

export class SkillGenerator {
  /**
   * Generate a skill definition from an insight
   */
  public generate(insight: Insight): GeneratedSkill | null {
    if (!insight.title || !insight.description) return null;

    const name = `auto-${sanitizeName(insight.title)}`;
    if (!FILENAME_REGEX.test(name)) return null;

    const triggerPatterns = this.extractTriggers(insight);
    const sanitizedTitle = sanitizeContent(insight.title);
    const sanitizedDesc = sanitizeContent(insight.description);

    const content = [
      '---',
      `name: ${name}`,
      `model: sonnet`,
      `triggers: [${triggerPatterns.map(t => `"${t}"`).join(', ')}]`,
      `generated: true`,
      `insightId: ${insight.id}`,
      `version: 1`,
      '---',
      '',
      `# ${sanitizedTitle}`,
      '',
      sanitizedDesc,
      '',
      insight.tags.length > 0 ? `Tags: ${insight.tags.join(', ')}` : '',
      '',
      `Confidence: ${insight.confidence.toFixed(2)}`,
      `Occurrences: ${insight.occurrences}`,
    ].filter(Boolean).join('\n');

    return { name, content, triggerPatterns };
  }

  private extractTriggers(insight: Insight): string[] {
    const triggers = new Set<string>();

    // Extract keywords from sanitized title (remove HTML-like tags)
    const cleanTitle = insight.title.replace(/<[^>]*>/g, '').toLowerCase();
    const words = cleanTitle.split(/\s+/).filter(w => w.length > 3);
    for (const word of words.slice(0, 3)) {
      triggers.add(word);
    }

    // Add sanitized tags as triggers
    for (const tag of insight.tags.slice(0, 2)) {
      triggers.add(tag.replace(/<[^>]*>/g, '').toLowerCase());
    }

    return [...triggers].slice(0, 5);
  }
}
