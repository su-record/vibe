/**
 * RoleSnapshotManager Unit Tests
 *
 * ARIA 스냅샷 파싱, Ref 생성, 변경 감지.
 */

import { describe, it, expect } from 'vitest';
import { RoleSnapshotManager } from './RoleSnapshotManager.js';

const SAMPLE_SNAPSHOT = `- main "Google"
  - navigation "Main"
    - link "Gmail"
    - link "Images"
  - searchbox "Search"
  - button "Google Search"
  - button "I'm Feeling Lucky"
  - group
    - link "Privacy"
    - link "Terms"`;

const SNAPSHOT_WITH_DUPLICATES = `- main
  - button "Submit"
  - button "Submit"
  - button "Cancel"
  - textbox "Name"
  - textbox "Email"`;

// ============================================================================
// Scenario 1: ARIA Snapshot 수집 — Ref 생성 검증
// ============================================================================

describe('RoleSnapshotManager: Ref Generation', () => {
  it('should generate sequential ref IDs (e1, e2, ...)', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    expect(Object.keys(result.refs).length).toBeGreaterThan(0);
    expect(result.refs.e1).toBeDefined();
    expect(result.refs.e2).toBeDefined();
  });

  it('should assign refs to interactive elements', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    // Search for link, searchbox, button refs
    const roles = Object.values(result.refs).map(r => r.role);
    expect(roles).toContain('link');
    expect(roles).toContain('searchbox');
    expect(roles).toContain('button');
  });

  it('should assign refs to named content elements', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    // "main" with name "Google" should have ref
    const mainRef = Object.values(result.refs).find(r => r.role === 'main' && r.name === 'Google');
    expect(mainRef).toBeDefined();
  });

  it('should include role and name in ref', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    const searchRef = Object.values(result.refs).find(r => r.role === 'searchbox');
    expect(searchRef).toBeDefined();
    expect(searchRef!.name).toBe('Search');
  });
});

// ============================================================================
// Duplicate Handling
// ============================================================================

describe('RoleSnapshotManager: Duplicate Handling', () => {
  it('should assign nth for duplicate role+name pairs', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SNAPSHOT_WITH_DUPLICATES);

    // Two "Submit" buttons should have nth
    const submitRefs = Object.values(result.refs)
      .filter(r => r.role === 'button' && r.name === 'Submit');

    expect(submitRefs.length).toBe(2);
    expect(submitRefs[0].nth).toBe(0);
    expect(submitRefs[1].nth).toBe(1);
  });

  it('should not assign nth for unique elements', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SNAPSHOT_WITH_DUPLICATES);

    const cancelRef = Object.values(result.refs)
      .find(r => r.role === 'button' && r.name === 'Cancel');

    expect(cancelRef).toBeDefined();
    expect(cancelRef!.nth).toBeUndefined();
  });
});

// ============================================================================
// Snapshot Options
// ============================================================================

describe('RoleSnapshotManager: Options', () => {
  it('should filter to interactive-only elements', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT, { interactive: true });

    // Only interactive roles should have refs
    const roles = Object.values(result.refs).map(r => r.role);
    for (const role of roles) {
      expect(['link', 'searchbox', 'button', 'textbox', 'checkbox', 'radio',
        'combobox', 'listbox', 'menuitem', 'option', 'slider', 'switch',
        'tab', 'treeitem']).toContain(role);
    }
  });

  it('should count interactive and total elements', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    expect(result.interactiveCount).toBeGreaterThan(0);
    expect(result.totalCount).toBeGreaterThan(result.interactiveCount);
  });
});

// ============================================================================
// Snapshot Versioning
// ============================================================================

describe('RoleSnapshotManager: Versioning', () => {
  it('should increment version with each snapshot', () => {
    const manager = new RoleSnapshotManager();

    const result1 = manager.buildSnapshot(SAMPLE_SNAPSHOT);
    const result2 = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    expect(result2.snapshotVersion).toBe(result1.snapshotVersion + 1);
  });

  it('should generate content checksum', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    expect(result.checksum).toMatch(/^[a-f0-9]{32}$/);
  });

  it('should generate same checksum for same content', () => {
    const manager1 = new RoleSnapshotManager();
    const manager2 = new RoleSnapshotManager();

    const result1 = manager1.buildSnapshot(SAMPLE_SNAPSHOT);
    const result2 = manager2.buildSnapshot(SAMPLE_SNAPSHOT);

    expect(result1.checksum).toBe(result2.checksum);
  });

  it('should generate different checksum for different content', () => {
    const manager = new RoleSnapshotManager();
    const result1 = manager.buildSnapshot(SAMPLE_SNAPSHOT);
    const result2 = manager.buildSnapshot(SNAPSHOT_WITH_DUPLICATES);

    expect(result1.checksum).not.toBe(result2.checksum);
  });
});

// ============================================================================
// Tree Output
// ============================================================================

describe('RoleSnapshotManager: Tree Output', () => {
  it('should include ref IDs in tree output', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    expect(result.tree).toContain('[e1]');
    expect(result.tree).toContain('[e2]');
  });

  it('should preserve indentation in tree', () => {
    const manager = new RoleSnapshotManager();
    const result = manager.buildSnapshot(SAMPLE_SNAPSHOT);

    // Should have indented lines
    const lines = result.tree.split('\n');
    const hasIndented = lines.some(l => l.startsWith('  '));
    expect(hasIndented).toBe(true);
  });
});
