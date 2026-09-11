# Optimize measured work

Use this guide when the user reports latency/cost, recorded work repeats, or a measured budget is exceeded. Do not run an optimization pass after every task.

Start with `vibe internal performance report --json`. It reads at most twenty recent check evidence files, each at most 1 MiB, without executing checks or writing records. The largest summed durations identify candidates, not proven waste. A repeated test may be necessary after a changed input or failure.

For CLI startup specifically, run `vibe internal performance startup --json` before and after a change under the same Node version, machine, project and load. It runs only fixed read-only CLI commands, two warmups and ten measurements each, with a timeout and output bound. It never benchmarks an arbitrary command, starts a model or creates a verdict. Store a baseline only when comparison is needed; avoid a background profiler or another persistent store.

For application performance, use the project's existing profiler and benchmark with representative inputs and explicit authority. Do not benchmark production writes, paid generation, publishing or uploads by repetition. Compare behavior and resource use on the same workload; report time, output bytes and measured tokens separately. Host tool calls and host token use are unavailable to the internal report, not zero.

Reuse the code guide for structure decisions. Prefer deleting repeated work, loading only needed modules, bounding output and sharing an existing implementation. Cache only when all relevant inputs and invalidation rules are known. Keep required verification, authorization and stale-evidence detection intact. Retain an optimization only if measured benefit or a concrete resource bound justifies its complexity. Stop after one measured improvement unless the remaining bottleneck still prevents the requested outcome.
