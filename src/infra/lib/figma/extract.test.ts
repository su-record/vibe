/**
 * Figma 추출 입력 타입 계약 (REQ-audit-p2-remediation-007)
 *
 * 배경: FigmaNode 는 이 파이프라인의 **출력** 타입인데 **입력**(Figma REST 응답)
 * 타입이 없어서 extract.ts 13건 + audit.ts 2건이 `any` 로 열려 있었다.
 * FigmaApiNode 도입 후 타입체커가 곧바로 잠재 런타임 버그를 잡았다:
 * fill/stroke/effect 의 `color` 가 없을 수 있는데 그대로 figmaColorToCSS 에
 * 넘겨 `undefined.r` 로 죽는 경로가 4곳 있었다. 이 테스트가 그 경로를 고정한다.
 */
import { describe, it, expect } from 'vitest';
import { walkNode, collectWarnings, collectRawNodes } from './extract.js';
import type { FigmaApiNode } from './types.js';

/** 최소 노드 — 필수 필드만 */
function node(partial: Partial<FigmaApiNode> & { id: string; type: string }): FigmaApiNode {
  return partial as FigmaApiNode;
}

describe('walkNode — 기본 변환', () => {
  it('Auto Layout 을 flex CSS 로 옮긴다', () => {
    const out = walkNode(node({
      id: '1:1', name: 'Row', type: 'FRAME',
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
      itemSpacing: 12,
    }));
    expect(out.css.display).toBe('flex');
    expect(out.css.flexDirection).toBe('row');
    expect(out.css.justifyContent).toBe('space-between');
    expect(out.css.alignItems).toBe('center');
    expect(out.css.gap).toBe('12px');
    expect(out.raw.itemSpacing).toBe(12);
  });

  it('TEXT 노드의 문자열과 타이포그래피를 담는다', () => {
    const out = walkNode(node({
      id: '1:2', name: 'Title', type: 'TEXT',
      characters: '안녕',
      style: { fontFamily: 'Inter', fontSize: 24, fontWeight: 700, textAlignHorizontal: 'CENTER' },
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
    }));
    expect(out.text).toBe('안녕');
    expect(out.css.fontSize).toBe('24px');
    expect(out.css.fontWeight).toBe('700');
    expect(out.css.textAlign).toBe('center');
    expect(out.css.color).toBe('#000000');
  });

  it('자식 트리를 재귀 변환한다', () => {
    const out = walkNode(node({
      id: '1:3', type: 'FRAME',
      children: [
        node({ id: '1:4', type: 'TEXT', characters: 'a' }),
        node({ id: '1:5', type: 'FRAME', children: [node({ id: '1:6', type: 'TEXT', characters: 'b' })] }),
      ],
    }));
    expect(out.children).toHaveLength(2);
    expect(out.children[1].children[0].nodeId).toBe('1:6');
    expect(out.hasTextChildren).toBe(true);
  });
});

describe('walkNode — 색상 누락 내성', () => {
  // 타입 도입 전에는 이 입력들이 전부 `undefined.r` 로 죽었다.
  it('color 없는 SOLID fill 에서 죽지 않는다', () => {
    const out = walkNode(node({ id: '2:1', type: 'RECTANGLE', fills: [{ type: 'SOLID' }] }));
    expect(out.css.backgroundColor).toBeUndefined();
  });

  it('color 없는 stroke 에서 죽지 않는다', () => {
    const out = walkNode(node({
      id: '2:2', type: 'RECTANGLE',
      strokes: [{ type: 'SOLID' }], strokeWeight: 2,
    }));
    expect(out.css.border).toBeUndefined();
  });

  it('color 없는 그림자에서 죽지 않는다', () => {
    const out = walkNode(node({
      id: '2:3', type: 'RECTANGLE',
      effects: [{ type: 'DROP_SHADOW', radius: 4 }],
    }));
    expect(out.css.boxShadow).toBeUndefined();
  });

  it('color 없는 텍스트 fill 에서 죽지 않는다', () => {
    const out = walkNode(node({
      id: '2:4', type: 'TEXT', characters: 'x',
      style: { fontSize: 12 },
      fills: [{ type: 'SOLID' }],
    }));
    expect(out.css.color).toBeUndefined();
    expect(out.text).toBe('x');
  });
});

describe('walkNode — 미지 필드와 결측 필드', () => {
  it('타입에 없는 필드가 응답에 있어도 무시하고 통과한다', () => {
    const withExtra = { id: '3:1', type: 'FRAME', someFutureFigmaField: { nested: true } } as unknown as FigmaApiNode;
    expect(() => walkNode(withExtra)).not.toThrow();
    expect(walkNode(withExtra).nodeId).toBe('3:1');
  });

  it('name 이 없으면 빈 문자열로 채운다', () => {
    expect(walkNode(node({ id: '3:2', type: 'FRAME' })).name).toBe('');
  });

  it('absoluteBoundingBox 가 없으면 size 는 null', () => {
    expect(walkNode(node({ id: '3:3', type: 'FRAME' })).size).toBeNull();
  });
});

describe('walkNode — 번역 불가 속성을 경고로 남긴다', () => {
  it('CSS 대응이 없는 blendMode 는 경고가 된다', () => {
    const out = walkNode(node({ id: '4:1', type: 'RECTANGLE', blendMode: 'LINEAR_BURN' }));
    const warnings = collectWarnings(out);
    expect(warnings.map(w => w.warning.property)).toContain('blendMode');
    expect(out.css.mixBlendMode).toBeUndefined();
  });

  it('CENTER 가 아닌 strokeAlign 은 경고가 된다', () => {
    const out = walkNode(node({
      id: '4:2', type: 'RECTANGLE',
      strokes: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
      strokeWeight: 1, strokeAlign: 'INSIDE',
    }));
    expect(collectWarnings(out).map(w => w.warning.property)).toContain('strokeAlign');
  });

  it('raw 수치는 비교 단계를 위해 보존된다', () => {
    const out = walkNode(node({ id: '4:3', type: 'FRAME', paddingTop: 8, paddingLeft: 4 }));
    const raws = collectRawNodes(out);
    expect(raws[0].raw.paddingTop).toBe(8);
    expect(raws[0].raw.paddingLeft).toBe(4);
  });
});
