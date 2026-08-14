/**
 * Figma REST API 타입 정의
 *
 * 두 방향의 타입이 한 파일에 있다:
 * - `FigmaApiNode` 계열 = Figma REST 응답의 **입력** 형태
 * - `FigmaNode` = 이 파이프라인이 만들어내는 **출력** 계약
 *
 * 입력 타입이 없어서 추출·감사 경로가 전부 `any` 로 열려 있었다 (2026-07-28 감사).
 * Figma API 전체를 모델링하지 않는다 — 코드가 실제로 읽는 필드만 담은 부분 타입이며,
 * 읽지 않는 필드가 응답에 더 있어도 무해하다.
 */
/** 0~1 정규화된 색상 채널. */
export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a?: number;
}
/** fills / strokes 항목. */
export interface FigmaPaint {
    type?: string;
    visible?: boolean;
    opacity?: number;
    color?: FigmaColor;
    imageRef?: string;
}
/** effects 항목 (그림자·블러). */
export interface FigmaEffect {
    type?: string;
    visible?: boolean;
    radius?: number;
    spread?: number;
    offset?: {
        x?: number;
        y?: number;
    };
    color?: FigmaColor;
}
/** TEXT 노드의 타이포그래피 속성. */
export interface FigmaTypeStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: string;
    leadingTrim?: string | boolean;
    textBoxTrim?: string | boolean;
}
export interface FigmaBoundingBox {
    width: number;
    height: number;
    x?: number;
    y?: number;
}
/** Figma REST 응답의 노드. 추출·감사 코드가 읽는 필드만 담는다. */
export interface FigmaApiNode {
    id: string;
    name?: string;
    type: string;
    children?: FigmaApiNode[];
    layoutMode?: string;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    itemSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    absoluteBoundingBox?: FigmaBoundingBox | null;
    layoutPositioning?: string;
    clipsContent?: boolean;
    cornerRadius?: number;
    rectangleCornerRadii?: number[];
    constraints?: {
        horizontal?: string;
        vertical?: string;
    };
    opacity?: number;
    blendMode?: string;
    fills?: FigmaPaint[];
    strokes?: FigmaPaint[];
    strokeWeight?: number;
    strokeAlign?: string;
    individualStrokeWeights?: Record<string, number>;
    effects?: FigmaEffect[];
    characters?: string;
    style?: FigmaTypeStyle;
    componentId?: string;
}
/** `/files/{key}/nodes?ids=` 응답. */
export interface FigmaNodesResponse {
    nodes?: Record<string, {
        document?: FigmaApiNode;
    } | undefined>;
}
/** `/images/{key}?ids=` 응답 (노드 렌더). */
export interface FigmaImagesResponse {
    images?: Record<string, string | null>;
}
/** `/files/{key}/images` 응답 (fill 이미지). */
export interface FigmaImageFillsResponse {
    meta?: {
        images?: Record<string, string>;
    };
}
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
    size: {
        width: number;
        height: number;
    } | null;
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
//# sourceMappingURL=types.d.ts.map