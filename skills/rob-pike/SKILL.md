---
name: rob-pike
tier: core
description: "Rob Pike's 5 Rules — block premature optimization. Auto-activates on optimize, slow, performance, cache, parallelize keywords."
triggers: [optimize, slow, performance, cache, parallelize, bottleneck, speed up, faster, latency, benchmark]
priority: 90
---

# Rob Pike's 5 Rules of Programming

## The Rules

1. **You can't tell where a program is going to spend its time.** Bottlenecks occur in surprising places. Don't guess — prove it.
2. **Measure.** Don't tune for speed until you've measured. Even then, don't unless one part of the code overwhelms the rest.
3. **Fancy algorithms are slow when n is small, and n is usually small.** Big-O doesn't matter when constants dominate. Use Rule 2 first.
4. **Fancy algorithms are buggier than simple ones.** Use simple algorithms and simple data structures.
5. **Data dominates.** Choose the right data structures and the algorithms become self-evident. "Write stupid code that uses smart objects."

## Before Any Optimization

### Step 0: Check for Existing Instrumentation

Before asking "have you measured?", determine whether measurement is even **possible** right now.

**Scan the codebase** for signs of existing instrumentation:
- Logging: logger imports, log calls, structured logging libraries
- Profiling: profiler imports, benchmark files, tracing setup
- Timing: duration measurements, stopwatch patterns, timing decorators
- APM/Observability: metrics exports, spans, trace contexts

**Then ask the user:**

1. If instrumentation **exists**: "I found logging/profiling in [locations]. Are there specific areas you suspect are slow, or should we look at what the existing measurements tell us?"
2. If instrumentation is **missing**: "There's no measurement in place. Before optimizing anything — where do you suspect the bottleneck is? Let's add measurement there first, then let the data decide."

### Step 1: Ask the Measurement Questions

Stop and ask these questions in order:

1. **"Have I measured?"** — If no, measure first.
2. **"Does one part overwhelm the rest?"** — If no single area dominates, nothing worth optimizing.
3. **"What's n?"** — If n is small (and it usually is), the simple O(n^2) approach likely beats the clever O(n log n) one.
4. **"Is this a data structure problem?"** — Before changing the algorithm, consider whether a different data structure makes the problem trivial.
5. **"Is the added complexity worth it?"** — Simple code that is 10% slower is almost always preferable to clever code that is fragile.

## Anti-Patterns to Block

| Impulse | Rule violated | Response |
|---|---|---|
| "This loop looks slow, let me optimize it" | Rule 1 | Have you profiled? The bottleneck may be elsewhere entirely. |
| "Let me add a cache here" | Rule 2 | Measure first. Does this path actually dominate runtime? |
| "Let me use a B-tree / trie / skip list" | Rule 3 | What's n? If small, a sorted slice + binary search wins. |
| "Let me implement a custom allocator" | Rule 4 | Start simple. Measure. Only get fancy if data forces you. |
| "The algorithm is O(n^2), needs fixing" | Rule 3 | What's n? O(n^2) with n=100 is 10us. Measure first. |
| "Let me parallelize this" | Rule 2 | Is this actually CPU-bound? Measure. Often it's I/O. |

## When Optimization IS Justified

Proceed only when ALL of these are true:

- You have measurement data showing a specific bottleneck
- That bottleneck dominates overall runtime (not just 5-10% of it)
- The proposed fix is the simplest change that addresses the measured problem
- You will re-measure after the change to confirm improvement
