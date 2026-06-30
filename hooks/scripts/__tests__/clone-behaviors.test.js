/**
 * clone active-interaction-sweep helpers
 *   - diffStyles: before/after computed-style differ (clone-extract.js)
 *   - sectionHasNode / behaviorsBlock: behavior→section attachment (clone-spec.js)
 */

import { describe, it, expect } from 'vitest';
import { diffStyles } from '../clone-extract.js';
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
});
