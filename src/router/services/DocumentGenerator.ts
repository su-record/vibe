/**
 * DocumentGenerator - LLM-based document generation
 * Outputs markdown format, optionally saves to Drive
 */

import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

export interface DocumentResult {
  title: string;
  content: string;
  format: 'markdown';
}

export class DocumentGenerator {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Generate a document from a description */
  async generate(description: string): Promise<DocumentResult> {
    const result = await this.smartRouter.route({
      type: 'code-gen',
      systemPrompt: DOC_SYSTEM_PROMPT,
      prompt: description,
    });
    if (!result.success) {
      throw new Error('문서 생성에 실패했습니다.');
    }
    const title = this.extractTitle(result.content);
    return { title, content: result.content, format: 'markdown' };
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)/m);
    return match?.[1]?.trim() ?? '새 문서';
  }
}

const DOC_SYSTEM_PROMPT = `문서 작성 전문가입니다. 사용자 요청에 맞는 마크다운 문서를 작성하세요.
- 제목은 # 레벨로 시작
- 구조화된 섹션 사용
- 한국어로 작성`;
