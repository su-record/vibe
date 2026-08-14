/**
 * DESIGN.md parser — Stitch 9-section format
 *
 * SSOT for /vibe.design lint + verify. Pure functions, no I/O.
 */
export const STITCH_SECTIONS = [
    'Visual Theme',
    'Color Palette',
    'Typography',
    'Components',
    'Layout',
    'Depth',
    "Do's & Don'ts",
    'Responsive',
    'Agent Prompt Guide',
];
const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
function matchStitchTitle(title) {
    const normalized = title.trim().toLowerCase().replace(/[`*_]/g, '');
    for (let i = 0; i < STITCH_SECTIONS.length; i++) {
        const canonical = STITCH_SECTIONS[i];
        if (normalized.includes(canonical.toLowerCase())) {
            return { index: i + 1, canonical };
        }
    }
    return null;
}
export function parseSections(content) {
    const lines = content.split(/\r?\n/);
    const sections = [];
    let current = null;
    const flush = () => {
        if (!current)
            return;
        const matched = matchStitchTitle(current.title);
        if (matched) {
            sections.push({
                index: matched.index,
                title: matched.canonical,
                body: current.bodyLines.join('\n').trim(),
            });
        }
    };
    for (const line of lines) {
        const heading = line.match(/^##\s+(.+?)\s*$/);
        if (heading) {
            flush();
            current = { title: heading[1], bodyLines: [] };
        }
        else if (current) {
            current.bodyLines.push(line);
        }
    }
    flush();
    return sections;
}
export function lintMissingSections(content) {
    const present = new Set(parseSections(content).map(s => s.title));
    return STITCH_SECTIONS.filter(s => !present.has(s));
}
export function extractHexTokens(designMd) {
    const colorSection = parseSections(designMd).find(s => s.index === 2);
    if (!colorSection)
        return [];
    const matches = colorSection.body.match(HEX_RE) ?? [];
    return [...new Set(matches.map(h => h.toLowerCase()))];
}
export function findHardcodedColors(files, allowedTokens) {
    const allowed = new Set(allowedTokens.map(t => t.toLowerCase()));
    const results = [];
    for (const file of files) {
        const lines = file.content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const matches = lines[i].match(HEX_RE);
            if (!matches)
                continue;
            for (const hex of matches) {
                if (!allowed.has(hex.toLowerCase())) {
                    results.push({ file: file.path, line: i + 1, hex });
                }
            }
        }
    }
    return results;
}
//# sourceMappingURL=design-md-parser.js.map