/**
 * ImageGenerator - LLM-based image generation
 * Uses SmartRouter to delegate to image-capable LLM providers
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

export interface ImageResult {
  description: string;
  url?: string;
  base64?: string;
}

export class ImageGenerator {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Generate image from text description */
  async generate(prompt: string): Promise<ImageResult> {
    const result = await this.smartRouter.route({
      type: 'code-gen',
      systemPrompt: IMAGE_SYSTEM_PROMPT,
      prompt: `이미지 생성 요청: ${prompt}`,
    });
    if (!result.success) {
      throw new Error('이미지 생성에 실패했습니다.');
    }
    return this.parseImageResponse(result.content, prompt);
  }

  private parseImageResponse(content: string, prompt: string): ImageResult {
    // Check for URL in response
    const urlMatch = content.match(/https?:\/\/[^\s)>\]]+\.(png|jpg|jpeg|gif|webp)/i);
    if (urlMatch) {
      return { description: prompt, url: urlMatch[0] };
    }
    // Check for base64 data
    const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (base64Match) {
      return { description: prompt, base64: base64Match[1] };
    }
    // Return description-only if no image URL/data
    return { description: content };
  }
}

const IMAGE_SYSTEM_PROMPT = `이미지 생성 도우미입니다. 사용자 요청에 맞는 이미지를 생성하세요.
가능하면 이미지 URL을 포함하여 반환하세요.`;
