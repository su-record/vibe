/** CsvDataLoader 생성자 옵션 */
export interface CsvDataLoaderOptions {
    /**
     * true 로 설정하면 파일 미존재·파싱 오류 시 console.warn 을 출력하지 않습니다.
     * 테스트에서 의도적으로 존재하지 않는 파일을 검사할 때 사용하세요.
     */
    quiet?: boolean;
}
/**
 * CSV 데이터 로더 - UI/UX Design Intelligence 시스템용
 *
 * 전역 경로에서 CSV 파일을 로드하며, papaparse를 사용합니다.
 */
export declare class CsvDataLoader {
    private basePaths;
    private quiet;
    constructor(customBasePath?: string, options?: CsvDataLoaderOptions);
    /**
     * CSV 파일을 로드하여 파싱된 데이터를 반환합니다.
     *
     * @param filename - CSV 파일명 (경로 없이 파일명만)
     * @returns 파싱된 데이터 배열 또는 null (에러 시)
     */
    load<T extends Record<string, string>>(filename: string): T[] | null;
    /**
     * CSV 파일이 존재하는지 확인합니다.
     *
     * @param filename - CSV 파일명
     * @returns 파일 존재 여부
     */
    exists(filename: string): boolean;
    /**
     * 첫 번째로 발견된 파일의 전체 경로를 반환합니다.
     * resolve/relative 기반으로 경로가 basePath 내부인지 검증합니다.
     *
     * @param filename - CSV 파일명
     * @returns 파일 경로 또는 null
     */
    private resolveFilePath;
    /**
     * 문자열에서 BOM(Byte Order Mark)을 제거합니다.
     *
     * @param content - 원본 문자열
     * @returns BOM이 제거된 문자열
     */
    private removeBom;
    /**
     * 파일명이 유효한지 검증합니다 (경로 탐색 공격 방지).
     * 절대 경로 및 null 바이트를 차단하고, resolve 기반 containment 검사는
     * resolveFilePath에서 수행합니다.
     *
     * @param filename - 검증할 파일명
     * @returns 유효 여부
     */
    private isValidFilename;
}
//# sourceMappingURL=CsvDataLoader.d.ts.map