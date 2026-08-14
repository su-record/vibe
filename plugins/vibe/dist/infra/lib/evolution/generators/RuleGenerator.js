// Rule Generator for self-evolution Phase 3
// Generates rule markdown files from anti-pattern/pattern insights
const FILENAME_REGEX = /^[a-z0-9-]+$/;
function sanitizeName(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9 \-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'auto-rule';
}
function sanitizeContent(text) {
    return text
        .replace(/<\/?role>/gi, '')
        .replace(/<\/?task>/gi, '')
        .replace(/<\/?context>/gi, '')
        .replace(/[^\x20-\x7E\r\n\t가-힣ㄱ-ㅎㅏ-ㅣ .,!?:;'"()\[\]{}\-_+=@#$%^&*/<>]/g, '');
}
export class RuleGenerator {
    /**
     * Generate a rule definition from an insight
     */
    generate(insight) {
        if (!insight.title || !insight.description)
            return null;
        const name = `auto-${sanitizeName(insight.title)}`;
        if (!FILENAME_REGEX.test(name))
            return null;
        const impact = insight.type === 'anti_pattern' ? 'HIGH' : 'MEDIUM';
        const sanitizedTitle = sanitizeContent(insight.title);
        const sanitizedDesc = sanitizeContent(insight.description);
        const content = [
            '---',
            `title: ${sanitizedTitle}`,
            `impact: ${impact}`,
            `tags: [auto-generated, ${insight.tags.map(t => sanitizeContent(t)).join(', ')}]`,
            `generated: true`,
            `insightId: ${insight.id}`,
            '---',
            '',
            `## ${sanitizedTitle}`,
            '',
            sanitizedDesc,
            '',
            `Confidence: ${insight.confidence.toFixed(2)}`,
            `Occurrences: ${insight.occurrences}`,
        ].join('\n');
        return { name, content };
    }
}
//# sourceMappingURL=RuleGenerator.js.map