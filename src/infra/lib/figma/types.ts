/**
 * Figma REST API 타입 정의
 */

/** Untranslated numeric values from Figma, kept alongside derived CSS so
 *  the compare step can diff against getComputedStyle without going through
 *  the CSS translation black box twice. */
export interface FigmaRawProps {
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  strokeWeight?: number;
  strokeAlign?: string;
  blendMode?: string;
  opacity?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
  fontWeight?: number;
}

/** Extraction warning — property was present in Figma but could not be
 *  translated to CSS (would have been silently dropped before). */
export interface FigmaWarning {
  property: string;
  value: string;
  reason: string;
}

export interface FigmaNode {
  nodeId: string;
  name: string;
  type: string;
  size: { width: number; height: number } | null;
  css: Record<string, string>;
  /** Untranslated numeric values — use these for reconciliation against getComputedStyle. */
  raw: FigmaRawProps;
  /** Properties that existed on the node but had no CSS equivalent. */
  warnings: FigmaWarning[];
  text?: string;
  imageRef?: string;
  /** Q1: any descendant carries meaningful TEXT (non-empty characters). */
  hasTextChildren?: boolean;
  /** Q2: 2+ direct children share the same componentId / name stem. */
  hasInstanceRepeat?: boolean;
  /** D1-D3: TEXT node whose visual fidelity cannot be preserved by HTML text. */
  isDesignText?: boolean;
  /** D4 helper: direct VECTOR-family children count. */
  vectorChildCount?: number;
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
