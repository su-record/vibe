/**
 * clone active-interaction-sweep helpers
 *   - diffStyles: before/after computed-style differ (clone-extract.js)
 *   - sectionHasNode / behaviorsBlock: behavior→section attachment (clone-spec.js)
 */

import { describe, it, expect } from 'vitest';
import { collectSubUrls, diffStyles } from '../clone-extract.js';
import { sectionHasNode, behaviorsBlock } from '../clone-spec.js';

describe('diffStyles', () => {
  it('reports only changed props with from/to', () => {
    const a = { 'background-color': 'rgba(0, 0, 0, 0)', height: '80px' };
    const b = { 'background-color': 'rgb(255, 255, 255)', height: '80px' };
    expect(diffStyles(a, b)).toEqual({
      'background-color': { from: 'rgba(0, 0, 0, 0)', to: 'rgb(255, 255, 255)' },
    });
  });

  it('captures props that appear or disappear', () => {
    const d = diffStyles({}, { 'box-shadow': '0 4px 20px rgba(0,0,0,0.1)' });
    expect(d['box-shadow']).toEqual({ from: null, to: '0 4px 20px rgba(0,0,0,0.1)' });
  });

  it('returns empty when nothing changed or a snapshot is missing', () => {
    expect(diffStyles({ color: 'red' }, { color: 'red' })).toEqual({});
    expect(diffStyles(null, { color: 'red' })).toEqual({});
  });
});

describe('collectSubUrls', () => {
  it('keeps same-origin locale menu links and drops footer/external links', () => {
    const urls = collectSubUrls('https://www.lgdisplay.com/kor', [
      { href: '/kor/company/info/outline/greeting', text: '기업개요' },
      { href: '/kor/product/tv/oled', text: 'TV' },
      { href: '/eng', text: 'ENG' },
      { href: '/kor/privacy', text: '개인정보처리방침' },
      { href: 'https://news.lgdisplay.com/news', text: 'Newsroom' },
      { href: 'https://www.youtube.com/@lgdisplay', text: 'You Tube' },
      { href: '#top', text: 'TOP' },
    ]);

    expect(urls).toEqual([
      'https://www.lgdisplay.com/kor',
      'https://www.lgdisplay.com/kor/company/info/outline/greeting',
      'https://www.lgdisplay.com/kor/product/tv/oled',
    ]);
  });

  it('deduplicates links after dropping query strings and hashes', () => {
    const urls = collectSubUrls('https://example.com/kor', [
      { href: '/kor/company?utm_source=x', text: 'Company' },
      { href: '/kor/company#ceo', text: 'Company' },
    ]);

    expect(urls).toEqual([
      'https://example.com/kor',
      'https://example.com/kor/company',
    ]);
  });
});

describe('behavior → section attachment', () => {
  const section = {
    name: 'Header',
    children: [{ tag: 'header', classes: 'site-nav top', children: [{ tag: 'button', classes: 'tab', children: [] }] }],
  };

  it('matches a node by tag and class', () => {
    expect(sectionHasNode(section, 'header', 'site-nav')).toBe(true);
    expect(sectionHasNode(section, 'header', 'missing')).toBe(false);
    expect(sectionHasNode(section, 'button')).toBe(true);
  });

  it('attaches a scroll behavior to the matching section only', () => {
    const behaviors = {
      scroll: [{ label: 'header.site-nav', tag: 'header', cls: 'site-nav', triggerScrollY: 700, changed: { height: { from: '80px', to: '56px' } } }],
      interactive: [{ kind: 'tab-group', count: 3, tabLabels: ['A', 'B', 'C'], contentSwapsOnClick: true }],
    };
    const block = behaviorsBlock(section, behaviors);
    expect(block).toContain('Scroll-triggered');
    expect(block).toContain('height');
    expect(block).toContain('content SWAPS on click');

    const footer = { name: 'Footer', children: [{ tag: 'p', classes: '', children: [] }] };
    expect(behaviorsBlock(footer, behaviors)).toBeNull();
  });

  it('renders hover / in-view / time-driven / scroll-lib behavior kinds', () => {
    const behaviors = {
      scroll: [],
      interactive: [],
      hover: [{ label: 'a.cta', tag: 'a', cls: 'cta', transition: 'all 0.3s ease 0s', changed: { 'background-color': { from: 'rgb(0, 0, 0)', to: 'rgb(255, 0, 0)' } } }],
      inview: [{ label: 'div.fade', tag: 'div', cls: 'fade', triggerY: 1400, changed: { opacity: { from: '0', to: '1' } } }],
      timeDriven: [{ label: 'div.slide', tag: 'div', cls: 'slide', mutations: 12, kinds: ['class'] }],
      scrollLib: { name: 'lenis', evidence: 'html.lenis' },
    };
    const hero = {
      name: 'Hero',
      children: [{ tag: 'div', classes: 'fade slide', children: [{ tag: 'a', classes: 'cta', children: [] }] }],
    };
    const block = behaviorsBlock(hero, behaviors);
    expect(block).toContain('**Hover** on `a.cta`');
    expect(block).toContain('transition: `all 0.3s ease 0s`');
    expect(block).toContain('**In-view entrance** on `div.fade` (enters at ~1400px)');
    expect(block).toContain('opacity: `0` → `1`');
    expect(block).toContain('**Time-driven** `div.slide` — 12 mutations/3s');
    expect(block).toContain('lenis');
  });

  it('renders a page-level scroll-lib note even when no section-scoped behavior matches', () => {
    const onlyLib = { scroll: [], interactive: [], scrollLib: { name: 'lenis', evidence: 'window.Lenis' } };
    const footer = { name: 'Footer', children: [{ tag: 'p', classes: '', children: [] }] };
    expect(behaviorsBlock(footer, onlyLib)).toContain('lenis');
  });

  it('suppresses the default transition value on hover entries', () => {
    const behaviors = {
      hover: [{ label: 'button.x', tag: 'button', cls: 'x', transition: 'all 0s ease 0s', changed: { color: { from: 'rgb(0, 0, 0)', to: 'rgb(9, 9, 9)' } } }],
    };
    const sec = { name: 'S', children: [{ tag: 'button', classes: 'x', children: [] }] };
    expect(behaviorsBlock(sec, behaviors)).not.toContain('transition:');
  });
});

describe('clone-spec CLI --real-content', () => {
  const runCli = async (extraArgs) => {
    const [fs, os, path, url, cp] = await Promise.all([
      import('fs'), import('os'), import('path'), import('url'), import('child_process'),
    ]);
    const tmp = fs.default.mkdtempSync(path.default.join(os.default.tmpdir(), 'clone-spec-'));
    const sections = path.default.join(tmp, 'sections.json');
    fs.default.writeFileSync(sections, JSON.stringify({
      meta: { feature: 'f', bp: 'mo', url: 'https://x.test' },
      sections: [{ name: 'Hero', nodeRef: '0', tag: 'section', css: {}, children: [] }],
    }));
    const script = url.default.fileURLToPath(new URL('../clone-spec.js', import.meta.url));
    cp.default.execFileSync('node', [script, sections, `--out=${tmp}/specs`, ...extraArgs]);
    return fs.default.readFileSync(path.default.join(tmp, 'specs', 'Hero.spec.md'), 'utf8');
  };

  it('defaults to placeholder replacement wording', async () => {
    const spec = await runCli([]);
    expect(spec).toContain('(replace copyrighted copy with placeholders)');
  });

  it('switches to verbatim wording with --real-content', async () => {
    const spec = await runCli(['--real-content']);
    expect(spec).toContain('(verbatim — user confirmed rights to reuse this copy)');
    expect(spec).not.toContain('(replace copyrighted copy with placeholders)');
  });
});
