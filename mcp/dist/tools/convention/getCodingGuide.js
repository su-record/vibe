// Convention management tool - completely independent
import { promises as fs } from 'fs';
import path from 'path';
const GUIDES_DIR = path.join(process.cwd(), 'guides');
const GUIDES_FILE = path.join(GUIDES_DIR, 'coding_guides.json');
async function ensureGuidesDir() {
    try {
        await fs.access(GUIDES_DIR);
    }
    catch {
        await fs.mkdir(GUIDES_DIR, { recursive: true });
    }
}
async function loadGuides() {
    try {
        await ensureGuidesDir();
        const data = await fs.readFile(GUIDES_FILE, 'utf-8');
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
async function findGuide(name) {
    const guides = await loadGuides();
    return guides.find(g => g.name === name);
}
export const getCodingGuideDefinition = {
    name: 'get_coding_guide',
    description: '가이드|규칙|컨벤션|guide|rules|convention|standards|best practices - Get coding guide',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Guide name to retrieve' },
            category: { type: 'string', description: 'Guide category' }
        },
        required: ['name']
    },
    annotations: {
        title: 'Get Coding Guide',
        audience: ['user', 'assistant']
    }
};
export async function getCodingGuide(args) {
    const { name: guideName, category: guideCategory } = args;
    try {
        const guide = await findGuide(guideName);
        if (guide) {
            return {
                content: [{ type: 'text', text: `Guide: ${guide.name}\nCategory: ${guide.category}\n\n${guide.content}\n\nTags: ${guide.tags.join(', ')} | Updated: ${guide.lastUpdated}` }]
            };
        }
        else {
            return {
                content: [{ type: 'text', text: `Guide not found: "${guideName}". Use list_coding_guides to see available guides.` }]
            };
        }
    }
    catch (error) {
        return {
            content: [{ type: 'text', text: `Error retrieving guide: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
    }
}
