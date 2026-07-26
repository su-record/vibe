# Feature: PM Skills + Workflow Chaining

**SPEC**: `.claude/vibe/specs/pm-skills-chaining.md`

## User Story
**As a** vibe user (developer or PM)
**I want** PM domain skills with workflow chaining
**So that** I can create PRDs, define personas, and prioritize features with guided next-step suggestions

## Scenarios

### Scenario 1: chain-next field parsing
```gherkin
Scenario: Parse chain-next from SKILL.md frontmatter
  Given a SKILL.md file with frontmatter containing "chain-next: [create-prd, user-personas]"
  When parseSkillFrontmatter() is called
  Then metadata.chainNext equals ["create-prd", "user-personas"]
```
**Verification**: SPEC AC #3

### Scenario 2: chain-next field generation
```gherkin
Scenario: Generate chain-next in frontmatter output
  Given a SkillMetadata with chainNext: ["create-prd", "user-personas"]
  When generateSkillFrontmatter() is called
  Then the output contains "chain-next: [create-prd, user-personas]"
```
**Verification**: SPEC AC #2

### Scenario 3: PM capability resolution
```gherkin
Scenario: Resolve PM skills from capability selection
  Given capabilities include "pm"
  When resolveLocalSkills([], ["pm"]) is called
  Then result contains ["create-prd", "prioritization-frameworks", "user-personas"]
```
**Verification**: SPEC AC #6

### Scenario 4: PM skill frontmatter validity
```gherkin
Scenario: Each PM skill has valid vibe frontmatter
  Given PM skill files exist at skills/create-prd/SKILL.md, skills/prioritization-frameworks/SKILL.md, skills/user-personas/SKILL.md
  When each file is parsed with parseSkillFrontmatter()
  Then each has non-empty name, description, triggers[], priority, and chainNext[]
```
**Verification**: SPEC AC #4, #5

### Scenario 5: Existing skills gain chain-next
```gherkin
Scenario: Retroactive chain-next on existing skills
  Given skills commit-push-pr, parallel-research, techdebt, exec-plan exist
  When each file is parsed with parseSkillFrontmatter()
  Then each has a non-empty chainNext[] array
```
**Verification**: SPEC AC #8

### Scenario 6: Build succeeds
```gherkin
Scenario: Project builds without errors
  Given all changes are applied
  When npm run build is executed
  Then exit code is 0
```
**Verification**: SPEC AC #9

### Scenario 7: single-element chain-next parsing
```gherkin
Scenario: Parse single-element chain-next array
  Given a SKILL.md file with frontmatter containing "chain-next: [create-prd]"
  When parseSkillFrontmatter() is called
  Then metadata.chainNext equals ["create-prd"]
```
**Verification**: SPEC AC #3

### Scenario 8: chainNext type verification
```gherkin
Scenario: SkillMetadata.chainNext is string[] | undefined
  Given SkillMetadata interface in SkillFrontmatter.ts
  When a SkillMetadata object is created with chainNext: ["a", "b"]
  Then TypeScript compiler accepts the value
  And when chainNext is omitted, TypeScript compiler also accepts
```
**Verification**: SPEC AC #1

### Scenario 9: chain-next omitted when undefined
```gherkin
Scenario: generateSkillFrontmatter omits chain-next for undefined
  Given a SkillMetadata with chainNext: undefined
  When generateSkillFrontmatter() is called
  Then the output does NOT contain "chain-next"
```
**Verification**: SPEC AC #11

### Scenario 10: chain-next outputs empty array
```gherkin
Scenario: generateSkillFrontmatter outputs empty array
  Given a SkillMetadata with chainNext: []
  When generateSkillFrontmatter() is called
  Then the output contains "chain-next: []"
```
**Verification**: SPEC AC #12

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-3 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-6, AC-7 | ⬜ |
| 4 | AC-4, AC-5 | ⬜ |
| 5 | AC-8 | ⬜ |
| 6 | AC-9, AC-10 | ⬜ |
| 7 | AC-3 | ⬜ |
| 8 | AC-1 | ⬜ |
| 9 | AC-11 | ⬜ |
| 10 | AC-12 | ⬜ |
