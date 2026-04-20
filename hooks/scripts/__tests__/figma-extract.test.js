import { describe, it, expect } from 'vitest';
import {
  walk,
  isDesignTextNode,
  hasTextDescendantRaw,
  hasRepeatingInstancesRaw,
  vectorChildCountRaw,
  shouldRenderImageAsBg,
  resolveImageFills,
  toHTML,
} from '../figma-extract.js';

// ─── Fixture helpers ────────────────────────────────────────────────

const bbox = (w = 100, h = 100, x = 0, y = 0) => ({ x, y, width: w, height: h });

function textNode(overrides = {}) {
  return {
    id: 'text-1', name: 'heading', type: 'TEXT', characters: 'Hello',
    absoluteBoundingBox: bbox(200, 40),
    style: { fontFamily: 'Inter', fontSize: 24, fontWeight: 600 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
    ...overrides,
  };
}

function frame(name, children = [], overrides = {}) {
  return {
    id: `frame-${name}`, name, type: 'FRAME',
    absoluteBoundingBox: bbox(800, 400),
    children,
    ...overrides,
  };
}

function imageFillNode(name, overrides = {}) {
  return {
    id: `img-${name}`, name, type: 'RECTANGLE',
    absoluteBoundingBox: bbox(400, 300),
    fills: [{ type: 'IMAGE', imageRef: 'ref-' + name, scaleMode: 'FILL' }],
    ...overrides,
  };
}

// ─── isDesignTextNode (D1-D3) ───────────────────────────────────────

describe('isDesignTextNode', () => {
  it('returns false for plain SOLID-filled text', () => {
    expect(isDesignTextNode(textNode())).toBe(false);
  });

  it('D1: detects 2+ visible fills', () => {
    const n = textNode({
      fills: [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } },
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 0.5 } },
      ],
    });
    expect(isDesignTextNode(n)).toBe(true);
  });

  it('D3: detects GRADIENT_LINEAR fill', () => {
    const n = textNode({
      fills: [{
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
        ],
        gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      }],
    });
    expect(isDesignTextNode(n)).toBe(true);
  });

  it('D2: detects DROP_SHADOW effect', () => {
    const n = textNode({ effects: [{ type: 'DROP_SHADOW', visible: true, radius: 4 }] });
    expect(isDesignTextNode(n)).toBe(true);
  });

  it('D2: detects visible stroke', () => {
    const n = textNode({ strokes: [{ type: 'SOLID', visible: true, color: { r: 1, g: 1, b: 1, a: 1 } }] });
    expect(isDesignTextNode(n)).toBe(true);
  });

  it('ignores invisible fills', () => {
    const n = textNode({
      fills: [
        { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } },
        { type: 'GRADIENT_LINEAR', visible: false },
      ],
    });
    expect(isDesignTextNode(n)).toBe(false);
  });

  it('returns false for non-TEXT nodes', () => {
    expect(isDesignTextNode({ type: 'FRAME', fills: [] })).toBe(false);
  });
});

// ─── hasTextDescendantRaw (Q1) ──────────────────────────────────────

describe('hasTextDescendantRaw', () => {
  it('true when node itself is non-empty TEXT', () => {
    expect(hasTextDescendantRaw(textNode())).toBe(true);
  });

  it('false when TEXT node has only whitespace', () => {
    expect(hasTextDescendantRaw(textNode({ characters: '   ' }))).toBe(false);
  });

  it('true when any descendant is TEXT', () => {
    const tree = frame('BG', [
      { id: 'g', name: 'group', type: 'GROUP', children: [textNode()] },
    ]);
    expect(hasTextDescendantRaw(tree)).toBe(true);
  });

  it('false for purely decorative VECTOR/RECTANGLE subtree', () => {
    const tree = frame('BG', [
      { id: 'v1', name: 'sparkle', type: 'VECTOR', children: [] },
      { id: 'v2', name: 'glow', type: 'RECTANGLE', children: [] },
    ]);
    expect(hasTextDescendantRaw(tree)).toBe(false);
  });
});

// ─── hasRepeatingInstancesRaw (Q2) ──────────────────────────────────

describe('hasRepeatingInstancesRaw', () => {
  it('true for 2+ INSTANCE children with same componentId', () => {
    const tree = frame('cards', [
      { id: 'i1', name: 'Card 1', type: 'INSTANCE', componentId: 'C:1', children: [] },
      { id: 'i2', name: 'Card 2', type: 'INSTANCE', componentId: 'C:1', children: [] },
    ]);
    expect(hasRepeatingInstancesRaw(tree)).toBe(true);
  });

  it('true for 2+ INSTANCE children with same name stem (trailing digits stripped)', () => {
    const tree = frame('list', [
      { id: 'i1', name: 'item 1', type: 'INSTANCE', children: [] },
      { id: 'i2', name: 'item 2', type: 'INSTANCE', children: [] },
    ]);
    expect(hasRepeatingInstancesRaw(tree)).toBe(true);
  });

  it('false for single INSTANCE', () => {
    const tree = frame('solo', [
      { id: 'i1', name: 'hero', type: 'INSTANCE', children: [] },
    ]);
    expect(hasRepeatingInstancesRaw(tree)).toBe(false);
  });

  it('false for mixed non-repeating INSTANCEs', () => {
    const tree = frame('mix', [
      { id: 'i1', name: 'hero', type: 'INSTANCE', componentId: 'C:A', children: [] },
      { id: 'i2', name: 'footer', type: 'INSTANCE', componentId: 'C:B', children: [] },
    ]);
    expect(hasRepeatingInstancesRaw(tree)).toBe(false);
  });
});

// ─── vectorChildCountRaw (D4 helper) ────────────────────────────────

describe('vectorChildCountRaw', () => {
  it('counts direct VECTOR-family children', () => {
    const tree = frame('parent', [
      { id: 'v1', type: 'VECTOR', children: [] },
      { id: 'v2', type: 'LINE', children: [] },
      { id: 'v3', type: 'BOOLEAN_OPERATION', children: [] },
      { id: 'r1', type: 'RECTANGLE', children: [] },
    ]);
    expect(vectorChildCountRaw(tree)).toBe(3);
  });

  it('returns 0 for leaf', () => {
    expect(vectorChildCountRaw({ id: 'x', type: 'FRAME' })).toBe(0);
  });
});

// ─── walk() integration: metadata propagates into tree ──────────────

describe('walk() metadata', () => {
  it('emits hasTextChildren on ancestors of TEXT nodes', () => {
    const raw = frame('section', [
      frame('BG', [textNode({ name: 'title' })]),
    ]);
    const tree = walk(raw);
    expect(tree.hasTextChildren).toBe(true);
    expect(tree.children[0].hasTextChildren).toBe(true); // BG frame too
  });

  it('omits hasTextChildren for pure decoration', () => {
    const raw = frame('section', [
      frame('BG', [
        { id: 'v1', name: 'glow', type: 'VECTOR', children: [] },
      ]),
    ]);
    const tree = walk(raw);
    expect(tree.hasTextChildren).toBeUndefined();
  });

  it('emits hasInstanceRepeat on parents of repeating INSTANCEs', () => {
    const raw = frame('list', [
      { id: 'c1', name: 'card 1', type: 'INSTANCE', componentId: 'C:1', children: [] },
      { id: 'c2', name: 'card 2', type: 'INSTANCE', componentId: 'C:1', children: [] },
    ]);
    const tree = walk(raw);
    expect(tree.hasInstanceRepeat).toBe(true);
  });

  it('emits isDesignText on gradient-filled TEXT', () => {
    const raw = textNode({
      fills: [{
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
        ],
        gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      }],
    });
    const tree = walk(raw);
    expect(tree.isDesignText).toBe(true);
  });
});

// ─── shouldRenderImageAsBg ──────────────────────────────────────────

describe('shouldRenderImageAsBg', () => {
  it('container with TEXT descendants → CSS bg', () => {
    const node = { name: 'hero', imageRef: 'r1', hasTextChildren: true, children: [{}] };
    expect(shouldRenderImageAsBg(node)).toBe(true);
  });

  it('container with repeating instances → CSS bg', () => {
    const node = { name: 'grid', imageRef: 'r1', hasInstanceRepeat: true, children: [{}, {}] };
    expect(shouldRenderImageAsBg(node)).toBe(true);
  });

  it('node named BG → CSS bg', () => {
    const node = { name: 'BG', imageRef: 'r1', children: [] };
    expect(shouldRenderImageAsBg(node)).toBe(true);
  });

  it('node named 배경 → CSS bg', () => {
    const node = { name: '배경', imageRef: 'r1', children: [] };
    expect(shouldRenderImageAsBg(node)).toBe(true);
  });

  it('container with non-vector children → CSS bg', () => {
    const node = {
      name: 'card', imageRef: 'r1',
      children: [{ type: 'FRAME' }],
    };
    expect(shouldRenderImageAsBg(node)).toBe(true);
  });

  it('leaf with image-like name → <img>', () => {
    const node = { name: 'photo-1', imageRef: 'r1', children: [] };
    expect(shouldRenderImageAsBg(node)).toBe(false);
  });

  it('leaf with generic name → <img> (default)', () => {
    const node = { name: 'Rectangle 5', imageRef: 'r1', children: [] };
    expect(shouldRenderImageAsBg(node)).toBe(false);
  });

  it('container with only VECTOR children still → CSS bg (parent is not a leaf image)', () => {
    const node = {
      name: 'hero',
      imageRef: 'r1',
      children: [{ type: 'VECTOR' }, { type: 'VECTOR' }],
    };
    expect(shouldRenderImageAsBg(node)).toBe(true);
  });
});

// ─── resolveImageFills + toHTML integration ─────────────────────────

describe('resolveImageFills', () => {
  it('converts BG-named leaf with IMAGE fill to CSS bg (no <img>)', () => {
    const tree = walk(frame('section', [imageFillNode('BG')]));
    const imageMap = { 'ref-BG': 'images/bg.webp' };
    resolveImageFills(tree, imageMap);
    const bgChild = tree.children[0];
    expect(bgChild.imageRef).toBeUndefined();
    expect(bgChild.renderAsBg).toBe(true);
    expect(bgChild.css.backgroundImage).toBe("url('images/bg.webp')");
    expect(bgChild.css.backgroundSize).toBe('cover');
  });

  it('keeps <img> for leaf named like a photo', () => {
    const tree = walk(frame('section', [imageFillNode('photo-hero')]));
    const imageMap = { 'ref-photo-hero': 'images/photo.webp' };
    resolveImageFills(tree, imageMap);
    const leaf = tree.children[0];
    expect(leaf.imageRef).toBe('ref-photo-hero');
    expect(leaf.renderAsBg).toBeUndefined();
  });

  it('converts IMAGE-fill container with TEXT descendant to CSS bg', () => {
    const container = imageFillNode('card', { type: 'FRAME' });
    container.children = [textNode({ name: 'title' })];
    const tree = walk(frame('section', [container]));
    const imageMap = { 'ref-card': 'images/card.webp' };
    resolveImageFills(tree, imageMap);
    const card = tree.children[0];
    expect(card.imageRef).toBeUndefined();
    expect(card.renderAsBg).toBe(true);
  });

  it('uses contain for FIT scale mode', () => {
    const tree = walk(frame('s', [imageFillNode('BG', { fills: [{ type: 'IMAGE', imageRef: 'ref-BG', scaleMode: 'FIT' }] })]));
    const imageMap = { 'ref-BG': 'images/bg.webp' };
    resolveImageFills(tree, imageMap);
    expect(tree.children[0].css.backgroundSize).toBe('contain');
  });
});

describe('toHTML after resolveImageFills', () => {
  it('BG-named image node renders as <div>, not <img>', () => {
    const tree = walk(frame('section', [imageFillNode('BG')]));
    const imageMap = { 'ref-BG': 'images/bg.webp' };
    resolveImageFills(tree, imageMap);
    const html = toHTML(tree, '', imageMap);
    expect(html).not.toMatch(/<img[^>]+images\/bg\.webp/);
    expect(html).toMatch(/<div class="section-bg"/);
  });

  it('standalone photo leaf renders as <img>', () => {
    const tree = walk(frame('section', [imageFillNode('photo-hero')]));
    const imageMap = { 'ref-photo-hero': 'images/photo.webp' };
    resolveImageFills(tree, imageMap);
    const html = toHTML(tree, '', imageMap);
    expect(html).toMatch(/<img[^>]+images\/photo\.webp/);
  });
});
