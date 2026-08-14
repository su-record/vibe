// Agent Generator for self-evolution Phase 3
// Generates agent markdown files from complex insights
const FILENAME_REGEX = /^[a-z0-9-]+$/;
function sanitizeName(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9 \-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) || 'auto-agent';
}
function sanitizeContent(text) {
    return text
        .replace(/<\/?role>/gi, '')
        .replace(/<\/?task>/gi, '')
        .replace(/<\/?context>/gi, '')
        .replace(/[^\x20-\x7E\r\n\t가-힣ㄱ-ㅎㅏ-ㅣ .,!?:;'"()\[\]{}\-_+=@#$%^&*/<>]/g, '');
}
export class AgentGenerator {
    /**
     * Generate an agent definition from a complex insight
     * Only generates agents for insights with 5+ evidence and 500+ char description
     */
    generate(insight) {
        // Complexity check
        if (insight.evidence.length < 5 || insight.description.length < 500) {
            return null;
        }
        const name = `auto-${sanitizeName(insight.title)}`;
        if (!FILENAME_REGEX.test(name))
            return null;
        const sanitizedTitle = sanitizeContent(insight.title);
        const sanitizedDesc = sanitizeContent(insight.description);
        const content = [
            `# ${sanitizedTitle}`,
            '',
            sanitizedDesc,
            '',
            '## Capabilities',
            '',
            ...insight.tags.map(tag => `- ${sanitizeContent(tag)}`),
            '',
            '## Tools',
            '',
            '- Read',
            '- Glob',
            '- Grep',
            '',
            `<!-- generated: true, insightId: ${insight.id} -->`,
        ].join('\n');
        return { name, content };
    }
}
//# sourceMappingURL=AgentGenerator.js.map