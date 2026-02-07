/**
 * FileAnalyzer - Analyze various file types via LLM
 * Supports: CSV, PDF, Image, JSON, YAML
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { InterfaceLogger } from '../../interface/types.js';
import { SmartRouterLike } from '../types.js';

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.json', '.yaml', '.yml', '.txt', '.md']);
const MAX_CONTENT_LENGTH = 50_000;

export interface AnalysisResult {
  filename: string;
  fileType: string;
  analysis: string;
}

export class FileAnalyzer {
  private logger: InterfaceLogger;
  private smartRouter: SmartRouterLike;

  constructor(logger: InterfaceLogger, smartRouter: SmartRouterLike) {
    this.logger = logger;
    this.smartRouter = smartRouter;
  }

  /** Analyze a file and return insights */
  async analyze(filePath: string): Promise<AnalysisResult> {
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    if (!this.isSupported(ext)) {
      return {
        filename,
        fileType: ext,
        analysis: `지원하지 않는 형식입니다 (${ext}). 지원 형식: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
      };
    }

    const content = this.readFileContent(filePath);
    const analysis = await this.analyzeContent(content, ext, filename);
    return { filename, fileType: ext, analysis };
  }

  /** Check if file extension is supported */
  isSupported(ext: string): boolean {
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  private readFileContent(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length > MAX_CONTENT_LENGTH) {
      return content.slice(0, MAX_CONTENT_LENGTH) + '\n\n... (이하 생략)';
    }
    return content;
  }

  private async analyzeContent(content: string, ext: string, filename: string): Promise<string> {
    const typePrompt = this.getTypeSpecificPrompt(ext);
    const result = await this.smartRouter.route({
      type: 'reasoning',
      systemPrompt: `파일 분석 전문가입니다. ${typePrompt}\n한국어로 분석 결과를 작성하세요.`,
      prompt: `파일명: ${filename}\n\n${content}`,
    });
    if (!result.success) {
      throw new Error('파일 분석에 실패했습니다.');
    }
    return result.content;
  }

  private getTypeSpecificPrompt(ext: string): string {
    switch (ext) {
      case '.csv':
        return '이 CSV 데이터를 분석하세요. 컬럼 설명, 데이터 패턴, 주요 인사이트를 제공하세요.';
      case '.json':
        return '이 JSON 데이터의 구조를 분석하세요. 스키마, 필드 설명, 데이터 특성을 설명하세요.';
      case '.yaml':
      case '.yml':
        return '이 YAML 설정 파일을 분석하세요. 구조, 설정 항목, 잠재적 이슈를 설명하세요.';
      case '.txt':
      case '.md':
        return '이 텍스트 콘텐츠를 분석하세요. 핵심 내용을 요약하고 주요 포인트를 정리하세요.';
      default:
        return '이 파일을 분석하세요.';
    }
  }

  /** Clean up temp file after analysis */
  static cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
