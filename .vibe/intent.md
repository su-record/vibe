# vibe 4 · phase 3d — exact implements edges and research narrowing

## Why
Two leftovers from phase 2b and 3b. The `implements` edge linked a passing scenario to every dirty file in the tree, so "which scenario touched this file" was too coarse to trust. And GitHub ANDs every search word, so the three-word queries research builds from an intent title often found nothing.

## What counts as success
- A scenario that passes for the first time is linked only to files whose content changed since the previous check, via a snapshot of changed-file content ids kept in `.vibe/snapshot.json`; the first check links every dirty file.
- A repository search that returns nothing is retried with fewer words, down to one.
- Earlier gates still hold: build, tests, card ≤ 1KB, source ≤ 5,000 lines, six common skills ≤ 300 lines.

## Constraints
- No new dependency; the snapshot uses git status and the same blob ids as the tree hash.
- Every record is English; the model talks to the user in the user's language.
