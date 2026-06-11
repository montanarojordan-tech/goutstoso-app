---
name: Goutstoso line-range removal pitfall
description: Using Python line-range deletion on index.tsx with stale line numbers cuts into unrelated components.
---

When removing large blocks from `artifacts/goutstoso/app/index.tsx` using Python line-range deletion:

**The rule:** Always re-grep for the exact start/end line numbers of the target section **immediately before** running the Python removal script, using the file as it stands at that exact moment.

**Why:** The file is ~17k lines. Any preceding edit (even a 30-line removal) shifts all subsequent line numbers. If you calculate removal ranges from grep output taken before earlier edits, your range will be offset — potentially cutting into adjacent components.

**How to apply:**
1. Apply all small/targeted edits first (individual function calls, JSX blocks).
2. Re-grep for section markers (`// MODULE :`, `// PDF :`, `const ComponentName`) immediately before the Python script runs.
3. Validate the range: print lines[start] and lines[end] before deleting to confirm they are what you expect.
4. After deletion, check that functions immediately after the removed range are still intact (`grep -n "^const <NextComponent>"` should return a result).

**What went wrong:** Python range was based on grep output from before ~180 lines of earlier edits, causing the Production component declaration to be included in the removal range and silently deleted.
