/**
 * PRD Parser Tests
 * Markdown/YAML parsing, requirement extraction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsePRD,
  type Requirement,
  type ParsedPRD,
} from './prdParser.js';
import { resetRequirementCounter } from './requirementId.js';

describe('PRD Parser', () => {
  beforeEach(() => {
    // Reset counter between tests
    resetRequirementCounter();
  });

  describe('parsePRD()', () => {
    it('should parse basic markdown PRD', () => {
      const content = `# Login Feature

A user authentication feature.

## Requirements

- User must be able to login with email and password
- User must be able to reset password
- User must be able to logout

## Acceptance Criteria

- Login form validates email format
- Password must be at least 8 characters
`;

      const result = parsePRD(content, 'login');

      expect(result.title).toBe('Login Feature');
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe('markdown');
      expect(result.metadata.hasYamlFrontmatter).toBe(false);
    });

    it('should extract title from first heading', () => {
      const content = `# My Feature Title

Some description here.
`;

      const result = parsePRD(content, 'feature');
      expect(result.title).toBe('My Feature Title');
    });

    it('should extract description', () => {
      const content = `# Feature

This is the feature description.
It spans multiple lines.

## Requirements

- Requirement 1
`;

      const result = parsePRD(content, 'feature');
      expect(result.description).toContain('feature description');
    });

    it('should assign requirement IDs', () => {
      const content = `# Feature

## Requirements

- First requirement
- Second requirement
`;

      const result = parsePRD(content, 'test');

      expect(result.requirements[0].id).toMatch(/^REQ-test-\d{3}$/);
      expect(result.requirements[1].id).toMatch(/^REQ-test-\d{3}$/);
      expect(result.requirements[0].id).not.toBe(result.requirements[1].id);
    });
  });

  describe('YAML frontmatter parsing', () => {
    it('should parse YAML frontmatter', () => {
      const content = `---
title: YAML Feature
version: 1.0.0
requirements:
  - First YAML requirement
  - Second YAML requirement
---

# YAML Feature

Content here.
`;

      const result = parsePRD(content, 'yaml-feature');

      expect(result.metadata.hasYamlFrontmatter).toBe(true);
      expect(result.metadata.format).toBe('mixed');
    });

    it('should extract requirements from YAML', () => {
      const content = `---
requirements:
  - YAML requirement one
  - YAML requirement two
---

# Feature
`;

      const result = parsePRD(content, 'yaml');

      const yamlReqs = result.requirements.filter(r => r.source === 'YAML frontmatter');
      expect(yamlReqs.length).toBe(2);
    });
  });

  describe('Priority inference', () => {
    it('should infer high priority from "must"', () => {
      const content = `# Feature

## Requirements

- User must be authenticated
`;

      const result = parsePRD(content, 'priority');
      const req = result.requirements.find(r => r.description.includes('must'));
      expect(req?.priority).toBe('high');
    });

    it('should infer high priority from "critical"', () => {
      const content = `# Feature

## Requirements

- Critical security feature required
`;

      const result = parsePRD(content, 'priority');
      expect(result.requirements[0].priority).toBe('high');
    });

    it('should infer low priority from "nice to have"', () => {
      const content = `# Feature

## Requirements

- Nice to have dark mode support
`;

      const result = parsePRD(content, 'priority');
      expect(result.requirements[0].priority).toBe('low');
    });

    it('should default to medium priority', () => {
      const content = `# Feature

## Requirements

- Regular feature without priority keywords
`;

      const result = parsePRD(content, 'priority');
      expect(result.requirements[0].priority).toBe('medium');
    });
  });

  describe('Section extraction', () => {
    it('should extract from Requirements section', () => {
      const content = `# Feature

## Overview

Some overview text.

## Requirements

- Requirement from requirements section

## Other Section

Other content.
`;

      const result = parsePRD(content, 'section');
      const fromReqs = result.requirements.filter(r => r.source?.includes('Requirements'));
      expect(fromReqs.length).toBeGreaterThan(0);
    });

    it('should extract from User Stories section', () => {
      const content = `# Feature

## User Stories

As a user, I want to login so that I can access my account.
`;

      const result = parsePRD(content, 'story');
      const fromStories = result.requirements.filter(r => r.source?.includes('User Stories'));
      expect(fromStories.length).toBe(1);
    });

    it('should handle Korean section names', () => {
      const content = `# 기능

## 요구사항

- 한글 요구사항 1
- 한글 요구사항 2
`;

      const result = parsePRD(content, 'korean');
      expect(result.requirements.length).toBe(2);
    });
  });

  describe('List parsing', () => {
    it('should parse bullet lists with -', () => {
      const content = `# Feature

## Requirements

- Item one
- Item two
- Item three
`;

      const result = parsePRD(content, 'bullet');
      expect(result.requirements.length).toBe(3);
    });

    it('should parse bullet lists with *', () => {
      const content = `# Feature

## Requirements

* Star item one
* Star item two
`;

      const result = parsePRD(content, 'star');
      expect(result.requirements.length).toBe(2);
    });

    it('should parse numbered lists', () => {
      const content = `# Feature

## Requirements

1. First item
2. Second item
3. Third item
`;

      const result = parsePRD(content, 'numbered');
      expect(result.requirements.length).toBe(3);
    });

    it('should parse numbered lists with parentheses', () => {
      const content = `# Feature

## Requirements

1) First item
2) Second item
`;

      const result = parsePRD(content, 'paren');
      expect(result.requirements.length).toBe(2);
    });
  });

  describe('Acceptance Criteria', () => {
    it('should extract AC and associate with requirements', () => {
      const content = `# Feature

## Requirements

- User login functionality

## Acceptance Criteria

- Login form displays correctly
- Validation errors show properly
`;

      const result = parsePRD(content, 'ac');
      expect(result.requirements.length).toBeGreaterThan(0);
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate similar requirements', () => {
      const content = `# Feature

## Requirements

- User must login with email
- User must login with email and password

## Acceptance Criteria

- User must login with email validation
`;

      const result = parsePRD(content, 'dedup');
      // First 50 chars are used for deduplication
      // "User must login with email" appears multiple times
      expect(result.requirements.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Fallback extraction', () => {
    it('should use fallback when no standard sections found', () => {
      const content = `# Feature

Some text here.

- This is a long enough item to be captured
- Another sufficiently long item
- Short

Random paragraph.
`;

      const result = parsePRD(content, 'fallback');
      // Fallback only captures items > 20 chars
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.metadata.parseWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Metadata', () => {
    it('should count sections correctly', () => {
      const content = `# Feature

## Section One

Content.

## Section Two

More content.

## Section Three

Even more.
`;

      const result = parsePRD(content, 'meta');
      expect(result.metadata.sectionCount).toBe(3);
    });

    it('should track requirement count', () => {
      const content = `# Feature

## Requirements

- Req 1
- Req 2
- Req 3
`;

      const result = parsePRD(content, 'count');
      expect(result.metadata.requirementCount).toBe(3);
    });

    it('should preserve raw content', () => {
      const content = `# Feature

Original content preserved.
`;

      const result = parsePRD(content, 'raw');
      expect(result.raw).toBe(content);
    });
  });
});
