/**
 * Figma 노드 → CSS 추출 + 트리 워커
 */
import type { FigmaNode, FigmaApiNode, FigmaRawProps, FigmaWarning, FigmaImageMap, FigmaTreeOptions, FigmaImageOptions, FigmaScreenshotOptions } from './types.js';
/**
 * Figma REST 노드 트리 → 이 파이프라인의 출력 계약(FigmaNode)으로 변환.
 * 네트워크와 분리된 순수 변환이라 fixture 로 단독 검증할 수 있다.
 */
export declare function walkNode(node: FigmaApiNode): FigmaNode;
export declare function getTree(options: FigmaTreeOptions): Promise<FigmaNode>;
export declare function collectImageRefs(node: FigmaNode, refs?: Set<string>): Set<string>;
/** Flat list of nodes with their raw numeric values — input for compareRaw. */
export declare function collectRawNodes(node: FigmaNode, out?: Array<{
    nodeId: string;
    name: string;
    raw: FigmaRawProps;
}>): Array<{
    nodeId: string;
    name: string;
    raw: FigmaRawProps;
}>;
/** Flat list of every extraction warning in the tree (silent-drop replacement). */
export declare function collectWarnings(node: FigmaNode, out?: Array<{
    nodeId: string;
    name: string;
    warning: FigmaWarning;
}>): Array<{
    nodeId: string;
    name: string;
    warning: FigmaWarning;
}>;
export declare function getImages(options: FigmaImageOptions): Promise<FigmaImageMap>;
export declare function getScreenshot(options: FigmaScreenshotOptions): Promise<{
    path: string;
    size: number;
}>;
//# sourceMappingURL=extract.d.ts.map