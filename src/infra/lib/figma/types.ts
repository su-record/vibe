/**
 * Figma REST API 타입 정의
 */

export interface FigmaNode {
  nodeId: string;
  name: string;
  type: string;
  size: { width: number; height: number } | null;
  css: Record<string, string>;
  text?: string;
  imageRef?: string;
  children: FigmaNode[];
}

export interface FigmaImageMap {
  total: number;
  images: Record<string, string>;
}

export interface FigmaTreeOptions {
  fileKey: string;
  nodeId: string;
  depth?: number;
}

export interface FigmaImageOptions {
  fileKey: string;
  nodeIds?: string[];
  imageRefs?: Set<string>;
  outDir: string;
  render?: boolean;
}

export interface FigmaScreenshotOptions {
  fileKey: string;
  nodeId: string;
  outPath: string;
  scale?: number;
  format?: 'png' | 'jpg' | 'svg';
}
