/**
 * PRD Parser - PRD 문서에서 요구사항 추출
 *
 * 지원 형식:
 * - Markdown 섹션 기반 (## Requirements, ## Acceptance Criteria)
 * - YAML 프론트매터
 * - 번호/불릿 리스트
 */
/** 추출된 요구사항 */
export interface Requirement {
    id: string;
    description: string;
    acceptanceCriteria: string[];
    priority: 'high' | 'medium' | 'low';
    category?: string;
    source?: string;
}
/** PRD 파싱 결과 */
export interface ParsedPRD {
    title: string;
    description?: string;
    requirements: Requirement[];
    metadata: PRDMetadata;
    raw: string;
}
/** PRD 메타데이터 */
export interface PRDMetadata {
    format: 'markdown' | 'yaml' | 'mixed';
    hasYamlFrontmatter: boolean;
    sectionCount: number;
    requirementCount: number;
    parseWarnings: string[];
}
/**
 * PRD 문서 파싱 (메인 함수)
 */
export declare function parsePRD(content: string, featureName: string): ParsedPRD;
/**
 * 파일에서 PRD 파싱 (파일 경로)
 */
export declare function parsePRDFile(filePath: string, featureName: string): Promise<ParsedPRD>;
//# sourceMappingURL=prdParser.d.ts.map