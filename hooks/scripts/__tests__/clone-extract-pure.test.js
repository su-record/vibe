/**
 * clone-extract 순수 경로 계약 (REQ-audit-p2-remediation-009)
 *
 * 배경: 훅 계층 최대 스크립트(1,291 L)인데 직접 테스트는 diffStyles·collectSubUrls
 * 두 함수뿐이었다(clone-behaviors.test.js). URL 정규화·스코프 판정·자산 파일명
 * 충돌 회피·HTML 살균처럼 클론 결과를 좌우하는 경로가 전부 미검증이었다.
 *
 * 브라우저를 띄우지 않는다 — puppeteer 의존 경로(capture/discoverSubUrls)는 대상 밖.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseArgs,
  parseViewport,
  localePrefixOf,
  normalizeSubUrl,
  isSameMenuScope,
  isExcludedSubLink,
  findSitemapUrl,
  uniqueFilename,
  sanitizeHtml,
} from '../clone-extract.js';

describe('parseArgs', () => {
  it('명령과 URL 을 위치 인자에서 뽑는다', () => {
    const { cmd, url } = parseArgs(['node', 'clone-extract.js', 'capture', 'https://a.com']);
    expect(cmd).toBe('capture');
    expect(url).toBe('https://a.com');
  });

  it('기본값은 interact 켜짐 / stealth·ignoreRobots 꺼짐', () => {
    expect(parseArgs(['n', 's', 'capture', 'u']).opts).toMatchObject({
      stealth: false, ignoreRobots: false, interact: true,
    });
  });

  it('값 있는 플래그와 불리언 플래그를 함께 처리한다', () => {
    const { opts } = parseArgs([
      'n', 's', 'capture', 'u',
      '--out=/tmp/x', '--viewport=375x812@2', '--bp=sm', '--wait=500',
      '--stealth', '--ignore-robots', '--no-interact',
    ]);
    expect(opts).toEqual({
      out: '/tmp/x', viewport: '375x812@2', bp: 'sm', wait: 500,
      stealth: true, ignoreRobots: true, interact: false,
    });
  });

  it('모르는 인자는 무시한다', () => {
    expect(() => parseArgs(['n', 's', 'capture', 'u', '--future-flag'])).not.toThrow();
  });
});

describe('parseViewport', () => {
  it('WxH 는 DPR 1 로 채운다', () => {
    expect(parseViewport('1440x900')).toEqual({ width: 1440, height: 900, deviceScaleFactor: 1 });
  });

  it('WxH@DPR 은 소수 DPR 도 받는다', () => {
    expect(parseViewport('375x812@2')).toEqual({ width: 375, height: 812, deviceScaleFactor: 2 });
    expect(parseViewport('375x812@1.5').deviceScaleFactor).toBe(1.5);
  });

  it('형식이 틀리면 기대 형식을 알려주며 실패한다', () => {
    // 조용히 기본값으로 넘어가면 잘못된 뷰포트로 캡처한 뒤에야 알게 된다
    for (const bad of ['', '1440', 'axb', '1440x', undefined]) {
      expect(() => parseViewport(bad)).toThrow(/Invalid viewport/);
    }
  });
});

describe('localePrefixOf', () => {
  it('첫 경로 조각이 로케일이면 접두사로 인정한다', () => {
    expect(localePrefixOf('https://a.com/ko/page')).toBe('/ko');
    expect(localePrefixOf('https://a.com/en-us/page')).toBe('/en-us');
  });

  it('로케일이 아니면 null', () => {
    expect(localePrefixOf('https://a.com/products/x')).toBeNull();
    expect(localePrefixOf('https://a.com/')).toBeNull();
  });
});

describe('normalizeSubUrl', () => {
  it('상대 경로를 기준 URL 로 해석한다', () => {
    expect(normalizeSubUrl('https://a.com/ko/', '/ko/about').href).toBe('https://a.com/ko/about');
  });

  it('해시와 쿼리를 떼어내 중복 판정이 되게 한다', () => {
    expect(normalizeSubUrl('https://a.com', '/p?utm=1#top').href).toBe('https://a.com/p');
  });

  it('말미 슬래시를 정규화하되 루트는 남긴다', () => {
    expect(normalizeSubUrl('https://a.com', '/p///').pathname).toBe('/p');
    expect(normalizeSubUrl('https://a.com', '/').pathname).toBe('/');
  });

  it('http(s) 가 아닌 스킴과 잘못된 입력은 null', () => {
    for (const bad of ['mailto:a@b.c', 'javascript:alert(1)', 'tel:123', '', null, undefined, 42]) {
      expect(normalizeSubUrl('https://a.com', bad)).toBeNull();
    }
  });
});

describe('isSameMenuScope', () => {
  const start = normalizeSubUrl('https://a.com/ko/', 'https://a.com/ko/');

  it('다른 오리진은 제외한다', () => {
    expect(isSameMenuScope(normalizeSubUrl('https://b.com', '/x'), start, '/ko')).toBe(false);
  });

  it('로케일 접두사가 있으면 그 안쪽만 포함한다', () => {
    expect(isSameMenuScope(normalizeSubUrl('https://a.com', '/ko/about'), start, '/ko')).toBe(true);
    expect(isSameMenuScope(normalizeSubUrl('https://a.com', '/ko'), start, '/ko')).toBe(true);
    expect(isSameMenuScope(normalizeSubUrl('https://a.com', '/en/about'), start, '/ko')).toBe(false);
  });

  it('접두사 유사 경로를 오인하지 않는다', () => {
    // /korean 은 /ko 안쪽이 아니다
    expect(isSameMenuScope(normalizeSubUrl('https://a.com', '/korean/x'), start, '/ko')).toBe(false);
  });

  it('로케일 접두사가 없으면 같은 오리진 전체가 범위다', () => {
    expect(isSameMenuScope(normalizeSubUrl('https://a.com', '/anything'), start, null)).toBe(true);
  });
});

describe('isExcludedSubLink', () => {
  it('유틸리티 링크 라벨을 제외한다', () => {
    for (const label of ['검색', 'search', 'sitemap', 'privacy', 'KOR', '사이트맵']) {
      expect(isExcludedSubLink(normalizeSubUrl('https://a.com', '/p'), label)).toBe(true);
    }
  });

  it('유틸리티 경로를 제외한다', () => {
    for (const p of ['/search', '/ko/login/', '/policy', '/auth/callback']) {
      expect(isExcludedSubLink(normalizeSubUrl('https://a.com', p), '메뉴')).toBe(true);
    }
  });

  it('문서·미디어 확장자를 제외한다', () => {
    for (const p of ['/a.pdf', '/b.zip', '/c.png', '/d.mp4', '/e.xlsx']) {
      expect(isExcludedSubLink(normalizeSubUrl('https://a.com', p), '자료')).toBe(true);
    }
  });

  it('일반 콘텐츠 링크는 남긴다', () => {
    expect(isExcludedSubLink(normalizeSubUrl('https://a.com', '/ko/products'), '제품')).toBe(false);
  });
});

describe('findSitemapUrl', () => {
  it('라벨이나 href 로 사이트맵을 찾는다', () => {
    expect(findSitemapUrl('https://a.com/ko/', [{ href: '/ko/sitemap', text: '사이트맵' }]))
      .toBe('https://a.com/ko/sitemap');
    expect(findSitemapUrl('https://a.com/ko/', [{ href: '/ko/sitemap', text: '전체보기' }]))
      .toBe('https://a.com/ko/sitemap');
  });

  it('범위 밖 사이트맵은 무시한다', () => {
    expect(findSitemapUrl('https://a.com/ko/', [{ href: 'https://b.com/sitemap', text: 'sitemap' }]))
      .toBeNull();
  });

  it('없으면 null', () => {
    expect(findSitemapUrl('https://a.com/', [{ href: '/about', text: '소개' }])).toBeNull();
  });
});

describe('uniqueFilename', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-clone-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('URL 마지막 조각을 파일명으로 쓴다', () => {
    expect(uniqueFilename('https://a.com/img/logo.png', dir, new Set())).toBe('logo.png');
  });

  it('확장자가 없으면 .bin 을 붙인다', () => {
    expect(uniqueFilename('https://a.com/asset', dir, new Set())).toBe('asset.bin');
  });

  it('파일명에 쓸 수 없는 문자를 치환한다', () => {
    expect(uniqueFilename('https://a.com/a%20b!c.png', dir, new Set())).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it('이미 본 이름과 충돌하면 다른 이름을 준다', () => {
    const seen = new Set(['logo.png']);
    expect(uniqueFilename('https://a.com/logo.png', dir, seen)).not.toBe('logo.png');
  });

  it('디스크에 이미 있는 파일과도 충돌하지 않는다', () => {
    fs.writeFileSync(path.join(dir, 'logo.png'), 'x');
    expect(uniqueFilename('https://a.com/logo.png', dir, new Set())).not.toBe('logo.png');
  });

  it('URL 로 파싱되지 않아도 죽지 않는다', () => {
    expect(uniqueFilename('::not a url::', dir, new Set())).toBeTruthy();
  });
});

describe('sanitizeHtml', () => {
  it('script 와 noscript 를 통째로 제거한다', () => {
    const out = sanitizeHtml('<div>keep</div><script>evil()</script><noscript>fallback</noscript>');
    expect(out).toContain('keep');
    expect(out).not.toContain('evil');
    expect(out).not.toContain('fallback');
  });

  it('여러 줄에 걸친 script 도 제거한다', () => {
    expect(sanitizeHtml('<script>\nline1\nline2\n</script>ok')).toBe('ok');
  });

  it('인라인 이벤트 핸들러를 제거한다', () => {
    const out = sanitizeHtml(`<a href="/x" onclick="bad()" onmouseover='worse()'>t</a>`);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
    expect(out).toContain('href="/x"');
  });

  it('일반 마크업은 건드리지 않는다', () => {
    const html = '<section class="hero"><h1>제목</h1></section>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});
