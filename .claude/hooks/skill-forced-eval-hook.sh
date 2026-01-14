#!/bin/bash
# Forced Eval Hook for Claude Code Skills
# Based on Scott Spence's research achieving 84% activation rate
# https://scottspence.com/posts/how-to-make-claude-code-skills-activate-reliably

cat << 'EOF'

=== MANDATORY SKILL EVALUATION PROTOCOL ===

CRITICAL: You MUST follow this 3-step process BEFORE any implementation.
Skipping this evaluation makes your response WORTHLESS.

Step 1 - EVALUATE: For each available skill, explicitly state YES or NO with a brief reason.
  Format: "- [skill-name]: YES/NO - [reason]"

Step 2 - ACTIVATE: For every skill marked YES, you MUST use Skill(skill-name) tool NOW.
  DO NOT proceed without activating matched skills.
  The evaluation is WORTHLESS unless you ACTIVATE the skills.

Step 3 - IMPLEMENT: Only AFTER skill activation, proceed with implementation.

REMEMBER:
- This is MANDATORY, not optional
- Your evaluation must be VISIBLE in your response
- Failure to activate matched skills = incomplete response

=== END PROTOCOL ===

EOF
