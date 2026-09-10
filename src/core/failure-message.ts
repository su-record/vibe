/** One explicitly retained diagnostic summary, not a transcript. Masking is best effort, not a secrecy guarantee. */
export function failureMessage(text: string, root: string): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const specific = lines.filter((line) => /\bTS\d{4,5}\b|\berror\b|\bfailed\b|\bFAIL\b|does not exist|\b(?:no-undef|no-unused-vars|@typescript-eslint\/[\w-]+)\b/i.test(line));
  const selected = specific.find((line) => /\bTS\d{4,5}\b|does not exist/i.test(line)) ?? specific.filter((line) => !/^\s*(?:Test Files|Tests|FAIL\s+\S+)\b/.test(line)).at(-1) ?? specific.at(-1);
  if (!selected) return null;
  return maskFailureLine(selected, root);
}

export function maskFailureLine(selected: string, root: string): string {
  return selected.replaceAll(root + '/', '').replaceAll(root + '\\', '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[credentials]@')
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']*/gi, '$1?[query]')
    .replace(/\b(Bearer)\s+[^\s"']+/gi, '$1 [redacted]')
    .replace(/\b(api[_-]?key|access[_-]?token|token|secret|password|authorization)\s*[:=]\s*["']?[^\s,;"']+["']?/gi, '$1=[redacted]')
    .replace(/\b(?:sk-|gh[pousr]_|AKIA)[A-Za-z0-9_-]{8,}\b/g, '[redacted]')
    .replace(/(^|[\s("'])(?:[A-Za-z]:[\\/]|\/)[^\s"')]+/g, '$1[path]')
    .replace(/\b[A-Za-z0-9+_=/-]{40,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ').slice(0, 200);
}
