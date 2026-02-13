/**
 * 코사인 유사도 계산 + 벡터 직렬화
 *
 * Float32Array 사용: 256차원 * 4바이트 = 1KB/벡터
 */

/**
 * 두 벡터의 코사인 유사도 계산 (0~1)
 * 동일 차원이어야 함. 빈 벡터는 0 반환.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * number[] → Buffer (Float32Array 직렬화)
 */
export function serializeVector(vec: number[]): Buffer {
  const float32 = new Float32Array(vec);
  return Buffer.from(float32.buffer);
}

/**
 * Buffer → Float32Array (역직렬화)
 */
export function deserializeVector(buf: Buffer): Float32Array {
  const arrayBuffer = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  );
  return new Float32Array(arrayBuffer);
}
