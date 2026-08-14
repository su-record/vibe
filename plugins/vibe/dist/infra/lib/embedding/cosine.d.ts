/**
 * 코사인 유사도 계산 + 벡터 직렬화
 *
 * Float32Array 사용: 256차원 * 4바이트 = 1KB/벡터
 */
/**
 * 두 벡터의 코사인 유사도 계산 (0~1)
 * 동일 차원이어야 함. 빈 벡터는 0 반환.
 */
export declare function cosineSimilarity(a: Float32Array, b: Float32Array): number;
/**
 * number[] → Buffer (Float32Array 직렬화)
 */
export declare function serializeVector(vec: number[]): Buffer;
/**
 * Buffer → Float32Array (역직렬화)
 */
export declare function deserializeVector(buf: Buffer): Float32Array;
//# sourceMappingURL=cosine.d.ts.map