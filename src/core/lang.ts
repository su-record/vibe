/**
 * Language of a text, by script. Only what the language packs need: Hangul → ko, Latin letters → en.
 * Anything else is unknown, and a review without an explicit `lang` fails with that reason.
 */
export type Lang = 'ko' | 'en';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/g;
const LATIN = /[A-Za-zÀ-ɏ]/g;
const MIN_LETTERS = 20;

export function detectLang(text: string): Lang | null {
  const hangul = (text.match(HANGUL) ?? []).length;
  const latin = (text.match(LATIN) ?? []).length;
  const letters = hangul + latin;
  if (letters < MIN_LETTERS) return null;
  if (hangul / letters >= 0.3) return 'ko';
  if (latin / letters >= 0.9) return 'en';
  return null;
}
