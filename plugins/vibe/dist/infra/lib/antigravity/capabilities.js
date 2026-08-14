/**
 * Antigravity 확장 기능
 *
 * - 웹 검색, UI 분석, 이미지 생성, 이미지 분석
 * - API Key → Google AI Studio
 */
import path from 'path';
import fs from 'fs';
import { getApiKeyFromConfig } from './auth.js';
import { ask, getAntigravityModels, DEFAULT_MODEL } from './chat.js';
// =============================================
// 웹 검색
// =============================================
/**
 * 웹서치로 최신 정보 검색 (Antigravity Pro + Google Search)
 */
export async function webSearch(prompt) {
    return ask(prompt, {
        model: 'antigravity-pro',
        maxTokens: 4096,
        temperature: 0.3,
        webSearch: true,
        systemPrompt: 'Search the web for the latest information and provide accurate answers. Always include today\'s date and time context when relevant.',
    });
}
/**
 * 빠른 웹서치 (Antigravity fast model + Google Search)
 */
export async function quickWebSearch(prompt) {
    return ask(prompt, {
        model: 'antigravity-fast',
        maxTokens: 2048,
        temperature: 0.3,
        webSearch: true,
    });
}
// =============================================
// UI 분석
// =============================================
/**
 * UI/UX 분석용 (Antigravity Pro)
 */
export async function analyzeUI(prompt) {
    return ask(prompt, {
        model: 'antigravity-pro',
        maxTokens: 4096,
        temperature: 0.5,
        systemPrompt: 'You are a UI/UX expert. Analyze the given design or component and provide detailed feedback.',
    });
}
// =============================================
// 이미지 생성
// =============================================
const IMAGE_MODELS = {
    'nano-banana': 'gemini-3.1-flash-image-preview',
    'nano-banana-pro': 'gemini-3-pro-image-preview',
};
/**
 * Antigravity image generation (API Key only)
 */
export async function generateImage(prompt, options = {}) {
    const apiKey = getApiKeyFromConfig();
    if (!apiKey) {
        throw new Error('Antigravity API key required for image generation. Run "vibe antigravity key <key>".');
    }
    const size = options.size || '1024x1024';
    const [width, height] = size.split('x').map(Number);
    const aspectRatio = width && height ? `${width}:${height}` : '1:1';
    const imageModel = IMAGE_MODELS[options.model || 'nano-banana'];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;
    const requestBody = {
        contents: [{
                parts: [{
                        text: `Generate an image: ${prompt}\n\nRequirements:\n- High quality, detailed image\n- Aspect ratio: ${aspectRatio}\n- Professional and polished look`,
                    }],
            }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Antigravity image API error (${response.status})`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.message)
                errorMessage = errorJson.error.message;
        }
        catch { /* ignore */ }
        throw new Error(errorMessage);
    }
    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
            return {
                data: Buffer.from(part.inlineData.data, 'base64'),
                mimeType: part.inlineData.mimeType,
            };
        }
    }
    throw new Error('No image in Antigravity response');
}
// =============================================
// 이미지 분석 (Multimodal)
// =============================================
function getImageMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
    };
    return mimeMap[ext] || 'image/png';
}
async function analyzeImageWithApiKey(apiKey, contents, options) {
    const modelInfo = getAntigravityModels()[options.model] || getAntigravityModels()[DEFAULT_MODEL];
    const actualModel = modelInfo.id;
    const requestBody = {
        contents,
        generationConfig: {
            maxOutputTokens: options.maxTokens,
            temperature: options.temperature,
        },
    };
    if (options.systemPrompt) {
        requestBody.systemInstruction = { parts: [{ text: options.systemPrompt }] };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Antigravity API error (${response.status}): ${errorText}`);
    }
    const result = await response.json();
    if (!result.candidates || result.candidates.length === 0) {
        throw new Error('Antigravity API response is empty.');
    }
    return result.candidates[0].content?.parts?.[0]?.text || '';
}
/**
 * Antigravity 이미지 분석 (Multimodal)
 */
export async function analyzeImage(imagePath, prompt, options = {}) {
    const { model = 'antigravity-fast', maxTokens = 4096, temperature = 0.3, systemPrompt, } = options;
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Image file not found: ${absolutePath}`);
    }
    const imageData = fs.readFileSync(absolutePath);
    const base64Data = imageData.toString('base64');
    const mimeType = getImageMimeType(absolutePath);
    const contents = [{
            role: 'user',
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt },
            ],
        }];
    const apiKey = getApiKeyFromConfig();
    if (!apiKey) {
        throw new Error('Antigravity API key required for image analysis.');
    }
    return analyzeImageWithApiKey(apiKey, contents, { model, maxTokens, temperature, systemPrompt });
}
//# sourceMappingURL=capabilities.js.map