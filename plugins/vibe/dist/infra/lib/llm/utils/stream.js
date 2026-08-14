/**
 * Streaming utilities for LLM responses
 */
/**
 * Parse Server-Sent Events (SSE) stream
 */
export async function parseSSEStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]')
                        continue;
                    try {
                        const parsed = JSON.parse(data);
                        // Handle OpenAI format
                        if (parsed.choices?.[0]?.delta?.content) {
                            result += parsed.choices[0].delta.content;
                        }
                        // Handle Responses API format
                        if (parsed.type === 'response.output_text.delta' && parsed.delta) {
                            result += parsed.delta;
                        }
                        // Handle Google generateContent format
                        if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                            result += parsed.candidates[0].content.parts[0].text;
                        }
                    }
                    catch {
                        // Skip unparseable lines
                    }
                }
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    return result;
}
/**
 * Parse SSE stream as async generator
 */
export async function* streamSSE(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                yield { type: 'done' };
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        yield { type: 'done' };
                        continue;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        let content;
                        // Handle different formats
                        if (parsed.choices?.[0]?.delta?.content) {
                            content = parsed.choices[0].delta.content;
                        }
                        else if (parsed.type === 'response.output_text.delta' && parsed.delta) {
                            content = parsed.delta;
                        }
                        else if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                            content = parsed.candidates[0].content.parts[0].text;
                        }
                        if (content) {
                            yield { type: 'delta', content };
                        }
                    }
                    catch {
                        // Skip unparseable lines
                    }
                }
            }
        }
    }
    catch (error) {
        yield {
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
        };
    }
    finally {
        reader.releaseLock();
    }
}
//# sourceMappingURL=stream.js.map