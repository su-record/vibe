/**
 * Antigravity 확장 기능
 *
 * - 웹 검색, UI 분석, 이미지 생성, 이미지 분석
 * - API Key → Google AI Studio
 */
import type { ImageGenerationOptions, ImageGenerationResult, ImageAnalysisOptions } from './types.js';
/**
 * 웹서치로 최신 정보 검색 (Antigravity Pro + Google Search)
 */
export declare function webSearch(prompt: string): Promise<string>;
/**
 * 빠른 웹서치 (Antigravity fast model + Google Search)
 */
export declare function quickWebSearch(prompt: string): Promise<string>;
/**
 * UI/UX 분석용 (Antigravity Pro)
 */
export declare function analyzeUI(prompt: string): Promise<string>;
/**
 * Antigravity image generation (API Key only)
 */
export declare function generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageGenerationResult>;
/**
 * Antigravity 이미지 분석 (Multimodal)
 */
export declare function analyzeImage(imagePath: string, prompt: string, options?: ImageAnalysisOptions): Promise<string>;
//# sourceMappingURL=capabilities.d.ts.map