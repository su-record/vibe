import { describe, expect, it } from 'vitest';
import { detectLang } from './lang.js';

describe('detectLang — script, not vocabulary', () => {
  it('Korean text is ko even with Latin terms inside', () => {
    expect(detectLang('이 원고는 API 와 JSON 을 그대로 두고 번역투만 걷어낸다. 편집자가 확인할 사실은 세 가지다.')).toBe('ko');
  });
  it('English text is en', () => {
    expect(detectLang('The column opens on a concrete scene and every paragraph moves the argument one step.')).toBe('en');
  });
  it('empty, too short, or other scripts are unknown', () => {
    expect(detectLang('')).toBeNull();
    expect(detectLang('ok')).toBeNull();
    expect(detectLang('これは日本語の原稿です。編集者が確認する事実は三つあります。すべての文が新しい情報を加える。')).toBeNull();
  });
});
