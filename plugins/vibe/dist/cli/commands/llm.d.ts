/**
 * `vibe llm` — LLM 모델 조회/최신화
 *
 *   vibe llm list       provider 별 현재 사용 가능한 모델 표시
 *   vibe llm refresh     라이브 조회 후 추천 모델을 ~/.vibe/config.json 에 반영
 *   vibe llm help
 */
export declare function llmList(): Promise<void>;
export declare function llmRefresh(): Promise<void>;
export declare function llmHelp(): void;
//# sourceMappingURL=llm.d.ts.map