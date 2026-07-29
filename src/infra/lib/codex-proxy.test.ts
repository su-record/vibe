/**
 * Codex 프록시 프로토콜 변환 계약 (REQ-audit-p2-remediation-008)
 *
 * 배경: 1,139 L 의 Anthropic↔OpenAI 번역 + SSE 스트리밍 계층에 직접 테스트가
 * 하나도 없었다. 이 경로가 조용히 깨지면 프록시를 거친 모든 요청이 잘못 번역되고,
 * 증상은 "모델이 이상하게 답한다" 로만 나타나 원인 추적이 어렵다.
 *
 * 네트워크·포트 바인딩 없이 순수 변환과 스트림 상태 전이만 검증한다.
 */
import { describe, it, expect } from 'vitest';
import type http from 'http';
import {
  buildOMessages,
  translateTools,
  translateToolChoice,
  buildORequest,
  mapFinishReason,
  buildAResponse,
  newStreamState,
  processChunk,
  closeStream,
  buildCodexInput,
  buildCodexTools,
  buildCodexRequest,
  buildCodexHeaders,
  newCodexStreamState,
  processCodexEvent,
  closeCodexStream,
} from './codex-proxy.js';

/** SSE 출력을 수집하는 가짜 응답 — 소켓 없이 이벤트 시퀀스를 관찰한다 */
function fakeRes(): { res: http.ServerResponse; events: Array<{ event: string; data: Record<string, unknown> }> } {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const res = {
    write(chunk: string) {
      const m = chunk.match(/^event: (.+)\ndata: (.+)\n\n$/);
      if (m) events.push({ event: m[1], data: JSON.parse(m[2]) as Record<string, unknown> });
      return true;
    },
  } as unknown as http.ServerResponse;
  return { res, events };
}

describe('메시지 번역 (Anthropic → OpenAI)', () => {
  it('system 을 문자열/블록 배열 양쪽에서 뽑아 앞에 붙인다', () => {
    expect(buildOMessages('be nice', [])[0]).toEqual({ role: 'system', content: 'be nice' });
    const fromBlocks = buildOMessages([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], []);
    expect(fromBlocks[0]).toEqual({ role: 'system', content: 'a\nb' });
  });

  it('system 이 없으면 system 메시지를 만들지 않는다', () => {
    expect(buildOMessages(undefined, [{ role: 'user', content: 'hi' }])).toEqual([
      { role: 'user', content: 'hi' },
    ]);
  });

  it('assistant 의 tool_use 를 tool_calls 로 옮긴다', () => {
    const out = buildOMessages(undefined, [
      { role: 'assistant', content: [
        { type: 'text', text: 'calling' },
        { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'x' } },
      ] },
    ]);
    expect(out[0].content).toBe('calling');
    expect(out[0].tool_calls?.[0]).toMatchObject({
      id: 'tu_1', type: 'function',
      function: { name: 'search', arguments: '{"q":"x"}' },
    });
  });

  it('tool_result 는 role: tool 메시지가 된다', () => {
    const out = buildOMessages(undefined, [
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'done' }] },
    ]);
    expect(out).toEqual([{ role: 'tool', tool_call_id: 'tu_1', content: 'done' }]);
  });

  it('thinking 블록은 전달하지 않는다', () => {
    const out = buildOMessages(undefined, [
      { role: 'user', content: [{ type: 'thinking', text: 'secret' }, { type: 'text', text: 'visible' }] },
    ]);
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(out[0].content).toBe('visible');
  });

  it('이미지 블록은 data URL 로 변환한다', () => {
    const out = buildOMessages(undefined, [
      { role: 'user', content: [
        { type: 'text', text: 'look' },
        { type: 'image', source: { type: 'base64', data: 'AAAA', media_type: 'image/jpeg' } },
      ] },
    ]);
    expect(JSON.stringify(out[0].content)).toContain('data:image/jpeg;base64,AAAA');
  });
});

describe('도구 정의 번역', () => {
  it('tools 를 function 스키마로 감싼다', () => {
    expect(translateTools([{ name: 'f', description: 'd', input_schema: { type: 'object' } }])).toEqual([
      { type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object' } } },
    ]);
  });

  it('tools 가 비었으면 undefined — 빈 배열을 보내지 않는다', () => {
    expect(translateTools([])).toBeUndefined();
    expect(translateTools(undefined)).toBeUndefined();
  });

  it('tool_choice 세 형태를 각각 매핑한다', () => {
    expect(translateToolChoice({ type: 'auto' })).toBe('auto');
    expect(translateToolChoice({ type: 'any' })).toBe('required');
    expect(translateToolChoice({ type: 'tool', name: 'f' })).toEqual({
      type: 'function', function: { name: 'f' },
    });
    expect(translateToolChoice(undefined)).toBeUndefined();
  });
});

describe('요청 본문 구성', () => {
  it('선택 파라미터는 있을 때만 싣는다', () => {
    const body = buildORequest({ model: 'm', messages: [], max_tokens: 10 });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
    expect(body).not.toHaveProperty('stop');
    expect(body.stream).toBe(false);
  });

  it('defaultModel 이 요청 모델을 덮어쓴다', () => {
    expect(buildORequest({ model: 'req', messages: [], max_tokens: 1 }, 'override').model).toBe('override');
  });

  it('스트리밍이면 usage 를 포함하도록 요청한다', () => {
    const body = buildORequest({ model: 'm', messages: [], max_tokens: 1, stream: true });
    expect(body.stream_options).toEqual({ include_usage: true });
  });
});

describe('종료 사유 매핑', () => {
  it('알려진 값을 Anthropic 어휘로 옮긴다', () => {
    expect(mapFinishReason('stop')).toBe('end_turn');
    expect(mapFinishReason('tool_calls')).toBe('tool_use');
    expect(mapFinishReason('length')).toBe('max_tokens');
  });

  it('미지·결측 값은 end_turn 으로 떨어진다', () => {
    expect(mapFinishReason(null)).toBe('end_turn');
    expect(mapFinishReason(undefined)).toBe('end_turn');
    expect(mapFinishReason('something_new')).toBe('end_turn');
  });
});

describe('비스트리밍 응답 구성', () => {
  it('텍스트와 도구 호출을 content 블록으로 편다', () => {
    const out = buildAResponse({
      choices: [{ message: { content: 'hi', tool_calls: [
        { id: 'c1', function: { name: 'f', arguments: '{"a":1}' } },
      ] }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 5, completion_tokens: 7 },
    }, 'model-x');

    const content = out.content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: 'text', text: 'hi' });
    expect(content[1]).toMatchObject({ type: 'tool_use', id: 'c1', name: 'f', input: { a: 1 } });
    expect(out.stop_reason).toBe('tool_use');
    expect(out.usage).toEqual({ input_tokens: 5, output_tokens: 7 });
    expect(out.model).toBe('model-x');
  });

  it('망가진 도구 인자 JSON 에도 죽지 않고 빈 입력으로 넘어간다', () => {
    const out = buildAResponse({
      choices: [{ message: { tool_calls: [{ id: 'c1', function: { name: 'f', arguments: '{oops' } }] } }],
    }, 'm');
    expect((out.content as Array<Record<string, unknown>>)[0]).toMatchObject({ input: {} });
  });

  it('빈 응답에도 계약 형태를 유지한다', () => {
    const out = buildAResponse({}, 'm');
    expect(out.type).toBe('message');
    expect(out.role).toBe('assistant');
    expect(out.content).toEqual([]);
    expect(out.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
  });
});

describe('SSE 스트림 상태 전이', () => {
  it('첫 텍스트 델타에서만 블록을 연다', () => {
    const { res, events } = fakeRes();
    const s = newStreamState('m');
    processChunk(res, s, { choices: [{ delta: { content: 'a' } }] });
    processChunk(res, s, { choices: [{ delta: { content: 'b' } }] });

    expect(events.filter(e => e.event === 'content_block_start')).toHaveLength(1);
    expect(events.filter(e => e.event === 'content_block_delta')).toHaveLength(2);
  });

  it('도구 호출이 시작되면 열린 텍스트 블록을 먼저 닫는다', () => {
    const { res, events } = fakeRes();
    const s = newStreamState('m');
    processChunk(res, s, { choices: [{ delta: { content: 'thinking' } }] });
    processChunk(res, s, { choices: [{ delta: { tool_calls: [
      { index: 0, id: 'c1', function: { name: 'f', arguments: '{"a"' } },
    ] } }] });

    const seq = events.map(e => e.event);
    expect(seq.indexOf('content_block_stop')).toBeLessThan(seq.lastIndexOf('content_block_start'));
  });

  it('같은 도구 인덱스의 후속 델타는 블록을 새로 열지 않는다', () => {
    const { res, events } = fakeRes();
    const s = newStreamState('m');
    for (const args of ['{"a"', ':1', '}']) {
      processChunk(res, s, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: args } }] } }] });
    }
    expect(events.filter(e => e.event === 'content_block_start')).toHaveLength(1);
    expect(events.filter(e => e.event === 'content_block_delta')).toHaveLength(3);
  });

  it('도구 인덱스가 다르면 별도 블록을 연다', () => {
    const { res, events } = fakeRes();
    const s = newStreamState('m');
    processChunk(res, s, { choices: [{ delta: { tool_calls: [
      { index: 0, id: 'c0', function: { name: 'f0', arguments: '{}' } },
      { index: 1, id: 'c1', function: { name: 'f1', arguments: '{}' } },
    ] } }] });
    expect(events.filter(e => e.event === 'content_block_start')).toHaveLength(2);
  });

  it('usage 와 finish_reason 을 상태에 누적한다', () => {
    const { res, events } = fakeRes();
    const s = newStreamState('m');
    processChunk(res, s, { usage: { prompt_tokens: 11, completion_tokens: 22 }, choices: [] });
    processChunk(res, s, { choices: [{ delta: {}, finish_reason: 'length' }] });
    closeStream(res, s);

    const delta = events.find(e => e.event === 'message_delta');
    expect((delta!.data.delta as Record<string, unknown>).stop_reason).toBe('max_tokens');
    expect((delta!.data.usage as Record<string, number>).output_tokens).toBe(22);
  });

  it('열린 블록이 없으면 닫기 이벤트도 내지 않는다', () => {
    const { res, events } = fakeRes();
    closeStream(res, newStreamState('m'));
    expect(events.filter(e => e.event === 'content_block_stop')).toHaveLength(0);
    expect(events.some(e => e.event === 'message_delta')).toBe(true);
  });
});

// ─── Codex Responses API 경로 (chatgpt-pro) ──────────────────────────
// 파일 안의 두 번째 번역 계층(~390 L). Anthropic ↔ OpenAI 경로와 별개이며
// 이벤트 이름·필드가 전혀 달라, 한쪽 테스트가 다른 쪽을 전혀 지켜주지 않는다.

describe('Codex Responses 입력 변환', () => {
  it('user/assistant 문자열을 각 역할의 input 항목으로 옮긴다', () => {
    expect(buildCodexInput([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])).toEqual([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'hello' }] },
    ]);
  });

  it('assistant 의 tool_use 는 function_call 항목이 된다', () => {
    const out = buildCodexInput([
      { role: 'assistant', content: [
        { type: 'text', text: 'calling' },
        { type: 'tool_use', id: 'tu_1', name: 'search', input: { q: 'x' } },
      ] },
    ]);
    expect(out[0]).toMatchObject({ type: 'message', role: 'assistant' });
    expect(out[1]).toEqual({
      type: 'function_call', call_id: 'tu_1', name: 'search', arguments: '{"q":"x"}',
    });
  });

  it('tool_result 는 function_call_output 항목이 된다', () => {
    expect(buildCodexInput([
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'done' }] },
    ])).toEqual([{ type: 'function_call_output', call_id: 'tu_1', output: 'done' }]);
  });

  it('thinking 블록은 전달하지 않는다', () => {
    const out = buildCodexInput([
      { role: 'user', content: [{ type: 'thinking', text: 'secret' }, { type: 'text', text: 'ok' }] },
    ]);
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('텍스트가 비면 빈 user 항목을 만들지 않는다', () => {
    expect(buildCodexInput([{ role: 'user', content: [{ type: 'text', text: '' }] }])).toEqual([]);
  });
});

describe('Codex Responses 요청 구성', () => {
  it('tools 를 Responses 형식(평면 name)으로 만든다', () => {
    // Chat Completions 는 { function: { name } }, Responses 는 최상위 name — 형태가 다르다
    expect(buildCodexTools([{ name: 'f', input_schema: { type: 'object' } }])).toEqual([
      { type: 'function', name: 'f', description: '', parameters: { type: 'object' } },
    ]);
    expect(buildCodexTools([])).toBeUndefined();
  });

  it('system 이 없으면 기본 instructions 를 채운다', () => {
    const body = buildCodexRequest({ model: 'm', messages: [], max_tokens: 1 });
    expect(body.instructions).toBe('You are a helpful assistant.');
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
  });

  it('system 이 있으면 instructions 로 옮긴다', () => {
    expect(buildCodexRequest({ model: 'm', system: 'be nice', messages: [], max_tokens: 1 }).instructions)
      .toBe('be nice');
  });

  it('헤더에 인증과 Codex 식별자를 담고 account 는 있을 때만 넣는다', () => {
    const h = buildCodexHeaders('tok');
    expect(h.Authorization).toBe('Bearer tok');
    expect(h['OpenAI-Beta']).toBe('responses=experimental');
    expect(h).not.toHaveProperty('chatgpt-account-id');
    expect(buildCodexHeaders('tok', 'acct')['chatgpt-account-id']).toBe('acct');
  });

  it('세션 id 는 호출마다 달라진다', () => {
    expect(buildCodexHeaders('t').session_id).not.toBe(buildCodexHeaders('t').session_id);
  });
});

describe('Codex Responses SSE 상태 전이', () => {
  it('첫 텍스트 델타에서만 블록을 연다', () => {
    const { res, events } = fakeRes();
    const s = newCodexStreamState('m');
    processCodexEvent(res, s, 'response.output_text.delta', { delta: 'a' });
    processCodexEvent(res, s, 'response.output_text.delta', { delta: 'b' });
    expect(events.filter(e => e.event === 'content_block_start')).toHaveLength(1);
    expect(events.filter(e => e.event === 'content_block_delta')).toHaveLength(2);
  });

  it('빈 델타는 무시한다', () => {
    const { res, events } = fakeRes();
    processCodexEvent(res, newCodexStreamState('m'), 'response.output_text.delta', { delta: '' });
    expect(events).toHaveLength(0);
  });

  it('function_call 항목이 오면 텍스트 블록을 닫고 도구 블록을 연다', () => {
    const { res, events } = fakeRes();
    const s = newCodexStreamState('m');
    processCodexEvent(res, s, 'response.output_text.delta', { delta: 'thinking' });
    processCodexEvent(res, s, 'response.output_item.added', {
      item: { type: 'function_call', call_id: 'c1', name: 'f' },
    });
    const seq = events.map(e => e.event);
    expect(seq.indexOf('content_block_stop')).toBeLessThan(seq.lastIndexOf('content_block_start'));
    expect(s.finishReason).toBe('tool_use');
  });

  it('function_call 이 아닌 output_item 은 블록을 열지 않는다', () => {
    const { res, events } = fakeRes();
    processCodexEvent(res, newCodexStreamState('m'), 'response.output_item.added', {
      item: { type: 'message' },
    });
    expect(events).toHaveLength(0);
  });

  it('인자 델타는 등록된 call_id 의 블록으로만 간다', () => {
    const { res, events } = fakeRes();
    const s = newCodexStreamState('m');
    processCodexEvent(res, s, 'response.output_item.added', {
      item: { type: 'function_call', call_id: 'c1', name: 'f' },
    });
    processCodexEvent(res, s, 'response.function_call_arguments.delta', { call_id: 'c1', delta: '{"a"' });
    processCodexEvent(res, s, 'response.function_call_arguments.delta', { call_id: 'unknown', delta: 'x' });
    expect(events.filter(e => e.event === 'content_block_delta')).toHaveLength(1);
  });

  it('response.completed 의 usage 를 상태에 담는다', () => {
    const { res } = fakeRes();
    const s = newCodexStreamState('m');
    processCodexEvent(res, s, 'response.completed', {
      response: { usage: { input_tokens: 3, output_tokens: 9 } },
    });
    expect(s.inputTokens).toBe(3);
    expect(s.outputTokens).toBe(9);
  });

  it('알 수 없는 이벤트는 조용히 무시한다', () => {
    const { res, events } = fakeRes();
    expect(() => processCodexEvent(res, newCodexStreamState('m'), 'response.future_event', {})).not.toThrow();
    expect(events).toHaveLength(0);
  });

  it('도구를 쓴 스트림은 tool_use 로 종료한다', () => {
    const { res, events } = fakeRes();
    const s = newCodexStreamState('m');
    processCodexEvent(res, s, 'response.output_item.added', {
      item: { type: 'function_call', call_id: 'c1', name: 'f' },
    });
    closeCodexStream(res, s);
    const delta = events.find(e => e.event === 'message_delta');
    expect((delta!.data.delta as Record<string, unknown>).stop_reason).toBe('tool_use');
    expect(events.at(-1)!.event).toBe('message_stop');
  });

  it('도구 없이 끝나면 end_turn 으로 종료한다', () => {
    const { res, events } = fakeRes();
    const s = newCodexStreamState('m');
    processCodexEvent(res, s, 'response.output_text.delta', { delta: 'a' });
    closeCodexStream(res, s);
    const delta = events.find(e => e.event === 'message_delta');
    expect((delta!.data.delta as Record<string, unknown>).stop_reason).toBe('end_turn');
  });
});
