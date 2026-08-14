/**
 * Interactive prompt utilities (readline/promises 기반)
 * vibe setup 위저드 등 인터랙티브 CLI에서 재사용
 */
import { Interface } from 'node:readline/promises';
export interface MenuOption {
    label: string;
    value: string;
}
/**
 * readline 인터페이스 생성 (위저드 전체에서 1개만 사용)
 */
export declare function createPromptSession(): Interface;
/**
 * 번호 선택 메뉴 표시 후 선택값 반환
 * 유효하지 않은 입력 시 재입력 요청
 */
export declare function chooseOption(rl: Interface, title: string, options: MenuOption[], defaultIndex?: number): Promise<string>;
/**
 * Yes/No 확인 프롬프트
 * @returns true = yes, false = no
 */
export declare function confirm(rl: Interface, question: string, defaultYes?: boolean): Promise<boolean>;
/**
 * 비어있지 않은 문자열 입력 (빈 입력 시 재입력 요청)
 */
export declare function askNonEmpty(rl: Interface, question: string): Promise<string>;
//# sourceMappingURL=prompt.d.ts.map