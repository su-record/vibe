/**
 * MessageCombiner - 다중 메시지 합산 유틸리티
 * Phase 3: Multi-Message Batching
 *
 * 순수 함수로 구현. BaseInterface + AgentLoop(Phase 4) 재사용.
 */

import type { ExternalMessage, FileAttachment, LocationInfo } from '../types.js';

/**
 * 여러 ExternalMessage를 하나로 합산한다.
 * - 1개: 그대로 반환
 * - 2개+: 시간순 정렬, [요청 N] 형식, files/location 병합
 */
export function combineMessages(messages: ExternalMessage[]): ExternalMessage {
  if (messages.length === 0) {
    throw new Error('No messages to combine');
  }
  if (messages.length === 1) {
    return messages[0];
  }

  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const contentParts = sorted.map((msg, i) => {
    const time = msg.timestamp.slice(11, 19); // HH:MM:SS
    return `[요청 ${i + 1}] (${time})\n${msg.content}`;
  });

  const allFiles: FileAttachment[] = [];
  let location: LocationInfo | undefined;

  for (const msg of sorted) {
    if (msg.files) allFiles.push(...msg.files);
    if (msg.location && !location) location = msg.location;
  }

  const first = sorted[0];

  return {
    id: first.id,
    channel: first.channel,
    chatId: first.chatId,
    userId: first.userId,
    content: contentParts.join('\n\n'),
    type: first.type,
    metadata: first.metadata,
    timestamp: first.timestamp,
    batchedFrom: sorted.map((m) => m.id),
    allTimestamps: sorted.map((m) => m.timestamp),
    ...(allFiles.length > 0 ? { files: allFiles } : {}),
    ...(location ? { location } : {}),
  };
}
