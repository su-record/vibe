/** The little XML that Office text needs: element bodies by tag, attributes, entity decoding. Not a parser. */
export function decodeEntities(text: string): string {
  return text.replace(/&(lt|gt|amp|quot|apos|#x?[0-9a-fA-F]+);/g, (m, e: string) => {
    if (e === 'lt') return '<';
    if (e === 'gt') return '>';
    if (e === 'amp') return '&';
    if (e === 'quot') return '"';
    if (e === 'apos') return "'";
    return String.fromCodePoint(e.startsWith('#x') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) || m;
  });
}

/** Every `<tag …>…</tag>` body, in order. Self-closing tags yield ''. */
export function bodies(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  for (const m of xml.matchAll(re)) out.push(m[1] ?? '');
  return out;
}

/** Every `<tag …>` opening (or self-closing) element with its attribute string and body. */
export function elements(xml: string, tag: string): Array<{ attrs: string; body: string }> {
  const out: Array<{ attrs: string; body: string }> = [];
  const re = new RegExp(`<${tag}(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  for (const m of xml.matchAll(re)) out.push({ attrs: m[1] ?? '', body: m[2] ?? '' });
  return out;
}

export function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(attrs);
  return m ? decodeEntities(m[1]!) : null;
}

/** Concatenated text of `<t>` elements (w:t, a:t, t) — the visible words of a run. */
export function textOf(xml: string, tag: string): string {
  return bodies(xml, tag).map(decodeEntities).join('');
}
