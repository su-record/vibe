---
name: vibe.user-personas
invocation: [auto, chain]
tier: standard
description: "Use when research data must be synthesized into three evidence-based user personas with JTBD, pains, gains, and unexpected insights."
triggers: [persona, user persona, user profile, user segment, user research]
priority: 50
chain-next: [vibe.create-prd, vibe.prioritization]
---

# User Personas

## Done Criteria

- [ ] 정확히 3개의 persona가 생성되어 있다.
- [ ] 각 persona에 JTBD, pains, gains가 모두 존재한다.
- [ ] 각 핵심 특성이 research source와 연결되어 있다.
- [ ] 근거 없는 추론은 inference로 표시되어 있다.

> Based on the user persona framework from [Product Compass](https://www.productcompass.pm/p/interviewing-customers-the-ultimate) by Pawel Huryn (MIT License).

## Purpose

Create detailed, actionable user personas from research data that capture the true diversity of your user base. This skill generates research-backed personas with jobs-to-be-done, pain points, desired outcomes, and unexpected behavioral insights to guide product decisions.

## Instructions

You are an experienced product researcher specializing in persona development and user research synthesis.

### Input

Your task is to create 3 refined user personas for **$ARGUMENTS**.

If the user provides CSV, Excel, survey responses, interview transcripts, or other research data files, read and analyze them directly using available tools. Extract key patterns, demographics, motivations, and behaviors.

### Analysis Steps (Think Step by Step)

1. **Data Collection**: Read and review all provided research data and documents
2. **Pattern Recognition**: Identify recurring characteristics, goals, pain points, and behaviors across users
3. **Segmentation**: Group similar users into distinct personas based on shared motivations and jobs-to-be-done
4. **Enrichment**: For each persona, synthesize data into a coherent profile
5. **Validation**: Cross-reference insights to ensure personas are grounded in actual research findings

### Output Structure

For each of the 3 personas, provide:

**Persona Name & Demographics**
- Age range, role/title, company size (if B2B), key characteristics

**Primary Job-to-be-Done**
- The core outcome the persona is trying to achieve
- Context and frequency of the job

**Top 3 Pain Points**
- Specific challenges or obstacles preventing job completion
- Impact and severity of each pain

**Top 3 Desired Gains**
- Benefits, outcomes, or solutions the persona seeks
- How they measure success

**One Unexpected Insight**
- A counterintuitive behavioral pattern or motivation derived from the data
- Why this matters for product decisions

**Product Fit Assessment**
- How $ARGUMENTS addresses (or could address) this persona's needs
- Potential friction points or unmet needs

## Best Practices

- Ground all insights in actual data; avoid assumptions
- Use direct quotes from research when available
- Identify behavioral patterns, not just demographic categories
- Make personas distinct and non-overlapping where possible
- Flag any data gaps or areas requiring additional research

## Further Reading

- [User Interviews: The Ultimate Guide to Research Interviews](https://www.productcompass.pm/p/interviewing-customers-the-ultimate)
- [Market Research: Advanced Techniques](https://www.productcompass.pm/p/market-research-advanced-techniques)
- [Jobs-to-be-Done Masterclass with Tony Ulwick and Sabeen Sattar](https://www.productcompass.pm/p/jobs-to-be-done-masterclass-with)
