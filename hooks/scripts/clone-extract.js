#!/usr/bin/env node

/**
 * clone-extract.js — 웹사이트 → 렌더링된 DOM/CSS/자산 정밀 추출
 *
 * Usage:
 *   node clone-extract.js capture <URL> --out=<dir> --viewport=375x812 --bp=mo [--stealth] [--ignore-robots]
 *
 * Output (in <dir>):
 *   rendered.html        — sanitized full DOM after JS
 *   computed.json        — per-element computed CSS + box + pseudo-elements + shadow DOM
 *   screenshot.png       — full-page screenshot
 *   stylesheets.json     — @font-face + @keyframes harvested from all sheets
 *   states.json          — non-default state rules (hover/focus/active/checked/tab/aria/data-state)
 *   asset-map.json       — remote URL → local path mapping
 *   assets/images/*, assets/fonts/*
 *
 * Requires: puppeteer (optional peer dep; `npm install puppeteer` if missing)
 *
 * Fidelity guarantees:
 *   1. Pseudo-elements (::before/::after) captured separately
 *   2. Shadow DOM traversed (open shadow roots)
 *   3. Inline SVG preserved as-is in nodes
 *   4. CSS custom properties (--vars) captured per element
 *   5. @font-face downloaded with format() preference (woff2 > woff > ttf)
 *   6. Node IDs stable via DOM path, not attribute mutation
 *   7. <picture>/srcset resolved to currentSrc (matches viewport)
 *   8. Gradients & multi-backgrounds preserved verbatim
 */

import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import http from 'http';
import https from 'https';

// ─── CSS property allow-list (captured per element) ─────────────────
// Kept narrow to keep computed.json sane; downstream scripts may add more.
const CSS_PROPS = [
  // layout / box
  'display', 'position', 'top', 'right', 'bottom', 'left', 'inset',
  'float', 'clear',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content',
  'align-self', 'justify-self', 'place-items', 'place-content',
  'gap', 'row-gap', 'column-gap', 'order', 'flex-grow', 'flex-shrink', 'flex-basis',
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
  'grid-column', 'grid-row', 'grid-area', 'grid-auto-flow', 'grid-auto-rows', 'grid-auto-columns',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'aspect-ratio',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'box-sizing', 'overflow', 'overflow-x', 'overflow-y', 'z-index',
  'pointer-events',
  // typography
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
  'text-decoration-color', 'text-decoration-thickness', 'text-underline-offset',
  'text-transform', 'text-shadow', 'color',
  'white-space', 'word-break', 'overflow-wrap', 'text-overflow',
  '-webkit-line-clamp', '-webkit-box-orient',
  // decoration / paint
  'background-color', 'background-image', 'background-size', 'background-position',
  'background-repeat', 'background-attachment', 'background-clip', 'background-origin',
  'background-blend-mode',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'box-shadow', 'opacity', 'mix-blend-mode', 'filter', 'backdrop-filter',
  'transform', 'transform-origin', 'perspective',
  'transition', 'animation', 'visibility',
  // content (pseudo-elements need this)
  'content', 'cursor', 'caret-color', 'list-style', 'object-fit', 'object-position',
  'mask-image', 'mask-size', 'mask-position', 'clip-path',
];

// ─── CLI parse ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const [, , cmd, urlArg, ...rest] = argv;
  const opts = { stealth: false, ignoreRobots: false };
  for (const arg of rest) {
    if (arg.startsWith('--out=')) opts.out = arg.slice(6);
    else if (arg.startsWith('--viewport=')) opts.viewport = arg.slice(11);
    else if (arg.startsWith('--bp=')) opts.bp = arg.slice(5);
    else if (arg.startsWith('--wait=')) opts.wait = Number(arg.slice(7));
    else if (arg === '--stealth') opts.stealth = true;
    else if (arg === '--ignore-robots') opts.ignoreRobots = true;
  }
  return { cmd, url: urlArg, opts };
}

function parseViewport(v) {
  const m = /^(\d+)x(\d+)(?:@(\d+(?:\.\d+)?))?$/.exec(v || '');
  if (!m) throw new Error(`Invalid viewport: ${v}. Expected WxH or WxH@DPR (e.g. 375x812@2)`);
  return {
    width: Number(m[1]),
    height: Number(m[2]),
    deviceScaleFactor: m[3] ? Number(m[3]) : 1,
  };
}

// ─── Puppeteer dynamic loader (optional dep) ────────────────────────
async function loadPuppeteer() {
  try {
    return await import('puppeteer');
  } catch {
    throw new Error(
      'puppeteer is not installed. Run: npm install puppeteer\n' +
      'Required for clone-extract.js (clone Phase 1).',
    );
  }
}

// ─── robots.txt check ───────────────────────────────────────────────
async function checkRobots(targetUrl) {
  const u = new URL(targetUrl);
  const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
  try {
    const body = await fetchText(robotsUrl, 5000);
    const lines = body.split('\n').map((l) => l.trim());
    let inStar = false;
    const disallows = [];
    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) inStar = true;
      else if (/^user-agent:/i.test(line)) inStar = false;
      else if (inStar && /^disallow:\s*/i.test(line)) {
        const p = line.replace(/^disallow:\s*/i, '').trim();
        if (p) disallows.push(p);
      }
    }
    const reqPath = u.pathname || '/';
    return disallows.some((p) => reqPath.startsWith(p));
  } catch {
    return false;
  }
}

function fetchText(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location, timeoutMs));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`timeout: ${url}`)));
  });
}

function fetchBinary(url, timeoutMs = 30000, depth = 0) {
  if (depth > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'Mozilla/5.0 clone' },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        return resolve(fetchBinary(next, timeoutMs, depth + 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// ─── Asset download with concurrency limit ──────────────────────────
async function downloadAssets(urls, outDir, concurrency = 8) {
  const queue = [...urls];
  const map = {};
  const seenNames = new Set();
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const u = queue.shift();
      if (!u) break;
      try {
        const buf = await fetchBinary(u);
        const filename = uniqueFilename(u, outDir, seenNames);
        const full = path.join(outDir, filename);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, buf);
        map[u] = { local: filename, status: 'ok', bytes: buf.length };
      } catch (e) {
        map[u] = { local: null, status: 'missing', error: String(e.message || e) };
      }
    }
  });
  await Promise.all(workers);
  return map;
}

function uniqueFilename(rawUrl, baseDir, seen) {
  let base;
  try {
    const u = new URL(rawUrl);
    base = path.basename(u.pathname) || 'asset';
  } catch {
    base = 'asset';
  }
  base = base.replace(/[?#].*$/, '') || 'asset';
  // sanitize
  base = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!path.extname(base)) base += '.bin';
  let candidate = base;
  let i = 1;
  while (seen.has(candidate) || fs.existsSync(path.join(baseDir, candidate))) {
    const ext = path.extname(base);
    const stem = base.slice(0, -ext.length);
    candidate = `${stem}-${i++}${ext}`;
  }
  seen.add(candidate);
  return candidate;
}

// ─── In-page extraction (runs inside the page) ──────────────────────
// IMPORTANT: this function is serialized to a string. It must be self-contained.
const PAGE_EXTRACT = `
(function (props) {
  const out = [];
  const stylesheets = { fontFaces: [], keyframes: [], cssVars: {} };
  const stateRules = [];
  const pathById = new Map();

  // ── Non-default state rule harvesting (hover/focus/active/checked/tab/aria/data-state) ──
  // Deterministic: read state-dependent declarations straight from the stylesheets
  // (no scripted clicking/hovering, so the output stays reproducible).
  const propSet = new Set(props);
  const STATE_RE = /:hover|:focus(?:-visible|-within)?|:active|:checked|:target|\\[aria-(?:expanded|selected|current|pressed)|\\[data-(?:state|active|open|selected)|\\[open\\]|\\.is-[a-z-]+|\\.(?:active|open|selected|expanded|current|show|visible)(?![\\w-])/i;
  const harvestStateRule = (rule, media) => {
    if (rule.selectorText && STATE_RE.test(rule.selectorText)) {
      const decl = {};
      for (let i = 0; i < rule.style.length; i++) {
        const p = rule.style[i];
        if (propSet.has(p)) decl[p] = rule.style.getPropertyValue(p).trim();
      }
      if (Object.keys(decl).length && stateRules.length < 1200) {
        stateRules.push({ selector: rule.selectorText.trim(), media: media || null, css: decl });
      }
    }
    // Recurse @media / @supports blocks so state rules nested under them are not lost
    if (rule.cssRules && (rule.media || rule.conditionText)) {
      const mq = rule.media ? rule.media.mediaText : (media || null);
      for (const r of rule.cssRules) harvestStateRule(r, mq);
    }
  };

  // Stable ID via DOM path (no attribute mutation)
  const pathFor = (el, parent) => {
    if (!parent) return '0';
    const siblings = Array.from(el.parentNode.children);
    const idx = siblings.indexOf(el);
    return parent + '.' + idx;
  };

  const captureCss = (cs) => {
    const css = {};
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v && v !== 'normal' && v !== 'auto' && v !== 'none' && v !== '0px' && v !== '') {
        css[p] = v.trim();
      } else if (v === '0px' || v === 'auto') {
        // keep zeros/auto for box model props
        if (/^(margin|padding|border|width|height|inset|top|right|bottom|left|gap)/.test(p)) {
          css[p] = v.trim();
        }
      }
    }
    // CSS custom properties
    const vars = {};
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (name && name.startsWith('--')) {
        vars[name] = cs.getPropertyValue(name).trim();
      }
    }
    if (Object.keys(vars).length) css['--vars'] = vars;
    return css;
  };

  const capturePseudo = (el, kind, parentId) => {
    const cs = getComputedStyle(el, '::' + kind);
    const content = cs.getPropertyValue('content');
    // Real pseudo-element only if content is not 'none' or empty
    if (!content || content === 'none' || content === 'normal') return null;
    const css = captureCss(cs);
    if (Object.keys(css).length <= 1) return null;
    return {
      id: parentId + '::' + kind,
      parent: parentId,
      tag: '::' + kind,
      pseudo: true,
      content: content,
      css,
    };
  };

  const isSvgElement = (el) => el.namespaceURI === 'http://www.w3.org/2000/svg';

  const captureSvg = (svg, id, parentId) => {
    return {
      id,
      parent: parentId,
      tag: 'svg',
      isSvg: true,
      svgMarkup: svg.outerHTML,
      box: rectOf(svg),
      css: captureCss(getComputedStyle(svg)),
    };
  };

  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    // Adjust for current scroll (we capture mid-scroll)
    return {
      x: Math.round((r.x + window.scrollX) * 100) / 100,
      y: Math.round((r.y + window.scrollY) * 100) / 100,
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
    };
  };

  const collectSrcset = (el) => {
    const ss = el.getAttribute('srcset') || el.getAttribute('data-srcset');
    if (!ss) return [];
    return ss.split(',').map((part) => {
      const bits = part.trim().split(/\\s+/);
      try { return new URL(bits[0], location.href).href; } catch { return null; }
    }).filter(Boolean);
  };

  const walk = (el, parentId, root) => {
    if (!(el instanceof Element)) return;

    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    // Keep visibility:hidden — may matter for layout (placeholders)

    const id = pathFor(el, parentId);
    pathById.set(id, el);

    if (isSvgElement(el) && el.tagName.toLowerCase() === 'svg') {
      out.push(captureSvg(el, id, parentId));
      return;
    }

    const node = {
      id,
      parent: parentId,
      tag: el.tagName.toLowerCase(),
      classes: el.getAttribute('class') || '',
      attrs: {
        src: el.getAttribute('src') || el.getAttribute('data-src') || null,
        currentSrc: (el.tagName === 'IMG' || el.tagName === 'SOURCE') ? (el.currentSrc || null) : null,
        srcset: el.getAttribute('srcset') || el.getAttribute('data-srcset') || null,
        href: el.getAttribute('href') || null,
        alt: el.getAttribute('alt') || null,
        title: el.getAttribute('title') || null,
        role: el.getAttribute('role') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        type: el.getAttribute('type') || null,
        name: el.getAttribute('name') || null,
        placeholder: el.getAttribute('placeholder') || null,
        value: el.getAttribute('value') || null,
      },
      text: '',
      box: rectOf(el),
      css: captureCss(cs),
    };

    // Direct text content (only if no element children to avoid duplication)
    if (el.children.length === 0 || Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE)) {
      let txt = '';
      for (const n of el.childNodes) {
        if (n.nodeType === Node.TEXT_NODE) txt += n.textContent;
      }
      txt = txt.trim();
      if (txt) node.text = txt.length > 2000 ? txt.slice(0, 2000) + '…' : txt;
    }

    out.push(node);

    // Pseudo elements
    const before = capturePseudo(el, 'before', id);
    if (before) out.push(before);
    const after = capturePseudo(el, 'after', id);
    if (after) out.push(after);

    // Shadow DOM (open shadow roots only)
    if (el.shadowRoot && el.shadowRoot.mode === 'open') {
      for (const child of el.shadowRoot.children) walk(child, id + '/shadow', root);
    }

    for (const child of el.children) walk(child, id, root);
  };

  walk(document.documentElement, null, document.documentElement);

  // Collect asset URLs (images + fonts) ─────────────────────────────
  const images = new Set();
  const fonts = new Set();

  document.querySelectorAll('img').forEach((img) => {
    if (img.currentSrc) images.add(img.currentSrc);
    else if (img.src) images.add(img.src);
    const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (ss) {
      ss.split(',').forEach((p) => {
        const u = p.trim().split(/\\s+/)[0];
        try { images.add(new URL(u, location.href).href); } catch {}
      });
    }
  });
  document.querySelectorAll('source').forEach((s) => {
    const ss = s.getAttribute('srcset');
    if (!ss) return;
    ss.split(',').forEach((p) => {
      const u = p.trim().split(/\\s+/)[0];
      try { images.add(new URL(u, location.href).href); } catch {}
    });
  });
  document.querySelectorAll('video, audio').forEach((el) => {
    if (el.poster) images.add(new URL(el.poster, location.href).href);
  });

  const bgUrlRe = /url\\(['"]?([^'")]+)['"]?\\)/g;
  document.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundImage;
    if (bg && bg !== 'none') {
      let m;
      const re = new RegExp(bgUrlRe.source, 'g');
      while ((m = re.exec(bg)) !== null) {
        try { images.add(new URL(m[1], location.href).href); } catch {}
      }
    }
    // also check pseudo bg
    for (const k of ['::before', '::after']) {
      const pcs = getComputedStyle(el, k);
      const pbg = pcs.backgroundImage;
      if (pbg && pbg !== 'none') {
        let m;
        const re = new RegExp(bgUrlRe.source, 'g');
        while ((m = re.exec(pbg)) !== null) {
          try { images.add(new URL(m[1], location.href).href); } catch {}
        }
      }
    }
  });

  // @font-face from all stylesheets
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const rule of rules) {
      if (rule.constructor.name === 'CSSFontFaceRule' || rule.type === 5) {
        const family = rule.style.getPropertyValue('font-family');
        const weight = rule.style.getPropertyValue('font-weight');
        const style = rule.style.getPropertyValue('font-style');
        const display = rule.style.getPropertyValue('font-display');
        const src = rule.style.getPropertyValue('src');
        const parsedSrcs = [];
        const re = /url\\(['"]?([^'")]+)['"]?\\)(?:\\s*format\\(['"]?([^'")]+)['"]?\\))?/g;
        let m;
        while ((m = re.exec(src)) !== null) {
          const abs = (() => { try { return new URL(m[1], location.href).href; } catch { return m[1]; } })();
          parsedSrcs.push({ url: abs, format: m[2] || null });
          fonts.add(abs);
        }
        stylesheets.fontFaces.push({
          family: family.replace(/^['"]|['"]$/g, ''),
          weight, style, display,
          sources: parsedSrcs,
        });
      } else if (rule.constructor.name === 'CSSKeyframesRule' || rule.type === 7) {
        const frames = [];
        for (const fr of rule.cssRules) frames.push({ keyText: fr.keyText, css: fr.cssText });
        stylesheets.keyframes.push({ name: rule.name, frames });
      }
    }
    for (const rule of rules) harvestStateRule(rule, null);
  }

  // :root CSS vars
  const rootCs = getComputedStyle(document.documentElement);
  for (let i = 0; i < rootCs.length; i++) {
    const name = rootCs[i];
    if (name && name.startsWith('--')) {
      stylesheets.cssVars[name] = rootCs.getPropertyValue(name).trim();
    }
  }

  return {
    nodes: out,
    assets: { images: Array.from(images), fonts: Array.from(fonts) },
    stylesheets,
    stateRules,
    title: document.title,
    html: document.documentElement.outerHTML,
    docSize: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
  };
})
`;

// ─── Progressive scroll to trigger lazy loading ─────────────────────
async function scrollToBottom(page) {
  await page.evaluate(`(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 400;
      const max = Math.max(document.documentElement.scrollHeight, 50000);
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight || total >= max) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          setTimeout(resolve, 600);
        }
      }, 80);
    });
  })()`);
}

// Freeze animations to a deterministic frame for stable capture
async function freezeAnimations(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-play-state: paused !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

// HTML sanitization: strip scripts/analytics before saving
function sanitizeHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '');
}

// ─── Main capture flow ──────────────────────────────────────────────
async function capture({ url, opts }) {
  if (!url) throw new Error('URL is required');
  if (!opts.out) throw new Error('--out=<dir> is required');
  if (!opts.viewport) throw new Error('--viewport=WxH is required');

  const viewport = parseViewport(opts.viewport);

  if (!opts.ignoreRobots) {
    const blocked = await checkRobots(url);
    if (blocked) {
      throw new Error(
        `robots.txt disallows ${url}. Pass --ignore-robots only with the site owner's permission.`,
      );
    }
  }

  fs.mkdirSync(opts.out, { recursive: true });
  const assetsDir = path.join(opts.out, 'assets');
  const imagesDir = path.join(assetsDir, 'images');
  const fontsDir = path.join(assetsDir, 'fonts');
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(fontsDir, { recursive: true });

  console.log(`[clone-extract] ${opts.bp || ''} ${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor} ${url}`);

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    // disable cache to get fresh assets
    await page.setCacheEnabled(false);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await scrollToBottom(page);
    if (opts.wait) await new Promise((r) => setTimeout(r, opts.wait));
    else await new Promise((r) => setTimeout(r, 1200));

    await freezeAnimations(page);

    const extracted = await page.evaluate(PAGE_EXTRACT, CSS_PROPS);

    // Screenshot AFTER freezing animations
    const shotPath = path.join(opts.out, 'screenshot.png');
    await page.screenshot({ path: shotPath, fullPage: true });

    // Pick best font per (family+weight+style): prefer woff2 > woff > ttf > otf
    const fontPriority = (fmt) => ({ woff2: 0, woff: 1, ttf: 2, otf: 3 }[fmt] ?? 9);
    const bestFontUrls = new Set();
    for (const ff of extracted.stylesheets.fontFaces) {
      const sorted = [...ff.sources].sort((a, b) => fontPriority(a.format) - fontPriority(b.format));
      if (sorted[0]) bestFontUrls.add(sorted[0].url);
    }
    // Also keep all referenced fonts (don't drop fallbacks completely — keep top 2 per face)
    const fontDownloadSet = new Set(bestFontUrls);
    for (const ff of extracted.stylesheets.fontFaces) {
      const sorted = [...ff.sources].sort((a, b) => fontPriority(a.format) - fontPriority(b.format));
      if (sorted[1]) fontDownloadSet.add(sorted[1].url);
    }

    console.log(`[clone-extract] downloading ${extracted.assets.images.length} images, ${fontDownloadSet.size} fonts (filtered from ${extracted.assets.fonts.length})`);
    const imageMap = await downloadAssets(extracted.assets.images, imagesDir, 8);
    const fontMap = await downloadAssets(Array.from(fontDownloadSet), fontsDir, 4);

    const assetMap = {};
    for (const [u, info] of Object.entries(imageMap)) {
      assetMap[u] = info.status === 'ok'
        ? { local: `assets/images/${info.local}`, status: 'ok', bytes: info.bytes, kind: 'image' }
        : { ...info, kind: 'image' };
    }
    for (const [u, info] of Object.entries(fontMap)) {
      assetMap[u] = info.status === 'ok'
        ? { local: `assets/fonts/${info.local}`, status: 'ok', bytes: info.bytes, kind: 'font' }
        : { ...info, kind: 'font' };
    }

    // Rewrite HTML — replace remote URLs with local paths
    let html = sanitizeHtml(extracted.html);
    const sortedUrls = Object.keys(assetMap).sort((a, b) => b.length - a.length);
    for (const u of sortedUrls) {
      const info = assetMap[u];
      if (info.status !== 'ok') continue;
      const escaped = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escaped, 'g'), info.local);
    }

    // Rewrite computed CSS values (background-image, mask-image) per node
    const rewriteCssValue = (val) => {
      if (!val || typeof val !== 'string') return val;
      let out = val;
      for (const u of sortedUrls) {
        const info = assetMap[u];
        if (info.status !== 'ok') continue;
        if (out.includes(u)) out = out.split(u).join(info.local);
      }
      return out;
    };
    for (const node of extracted.nodes) {
      if (!node.css) continue;
      for (const prop of ['background-image', 'mask-image', 'content', 'border-image']) {
        if (node.css[prop]) node.css[prop] = rewriteCssValue(node.css[prop]);
      }
    }

    // Rewrite @font-face srcs in stylesheets.fontFaces
    for (const ff of extracted.stylesheets.fontFaces) {
      ff.sources = ff.sources.map((s) => {
        const info = assetMap[s.url];
        return info && info.status === 'ok'
          ? { ...s, url: info.local, original: s.url }
          : s;
      });
    }

    // Rewrite remote asset URLs inside harvested state rules (e.g. :hover background-image)
    for (const sr of extracted.stateRules) {
      if (!sr.css) continue;
      for (const prop of ['background-image', 'mask-image', 'border-image']) {
        if (sr.css[prop]) sr.css[prop] = rewriteCssValue(sr.css[prop]);
      }
    }

    // Write outputs
    fs.writeFileSync(path.join(opts.out, 'rendered.html'), html);
    fs.writeFileSync(
      path.join(opts.out, 'computed.json'),
      JSON.stringify({
        meta: {
          url,
          viewport,
          bp: opts.bp || null,
          title: extracted.title,
          docSize: extracted.docSize,
          capturedAt: new Date().toISOString(),
        },
        nodes: extracted.nodes,
      }),
    );
    fs.writeFileSync(
      path.join(opts.out, 'stylesheets.json'),
      JSON.stringify(extracted.stylesheets, null, 2),
    );
    fs.writeFileSync(
      path.join(opts.out, 'states.json'),
      JSON.stringify({
        meta: { url, bp: opts.bp || null, capturedAt: new Date().toISOString() },
        stateRules: extracted.stateRules,
      }, null, 2),
    );
    fs.writeFileSync(path.join(opts.out, 'asset-map.json'), JSON.stringify(assetMap, null, 2));

    const okCount = Object.values(assetMap).filter((a) => a.status === 'ok').length;
    console.log(`[clone-extract] done → ${opts.out}`);
    console.log(`  nodes: ${extracted.nodes.length}, fontFaces: ${extracted.stylesheets.fontFaces.length}, stateRules: ${extracted.stateRules.length}`);
    console.log(`  assets: ${okCount}/${Object.keys(assetMap).length} downloaded`);
  } finally {
    await browser.close();
  }
}

// ─── Entry ──────────────────────────────────────────────────────────
const { cmd, url, opts } = parseArgs(process.argv);

if (cmd !== 'capture') {
  console.error('Usage: node clone-extract.js capture <URL> --out=<dir> --viewport=WxH[@DPR] --bp=mo|pc [--stealth] [--ignore-robots] [--wait=ms]');
  process.exit(1);
}

capture({ url, opts }).catch((err) => {
  console.error(`[clone-extract] FAIL: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
