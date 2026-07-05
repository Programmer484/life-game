---
name: orchestrate-slices
description: Orchestrate a multi-slice change on this repo — decompose into worker slices, scope each one, run workers in parallel worktrees, review their reports, and integration-test the merged stack. Use when a task spans more than one module or needs more than one PR (feature passes, polish passes, mechanic changes). Not for single-module edits — just do those directly.
---

# Orchestrating worker slices on this repo

You are the orchestrator: you decompose, brief, review, and integrate.
**Workers implement; you never write feature code directly.** The one
exception is no-code work (asset generation, doc production) — do that
yourself, but still ship it as its own PR.

Read `CLAUDE.md` (framework rails) and the implementation overview
(`IMPLEMENTATION.md` / `V1_IMPLEMENTATION.md`, whichever exists) before
decomposing. Everything below rides the existing pipeline: **one slice =
one spec = one worker = one `pnpm verify`-green draft PR.**

## 1. Decompose into slices

- A slice is the smallest unit that ends green: it must pass `pnpm verify`
  AND `pnpm build` on its own, in dependency order.
- Cut slices along **module boundaries**, not features. One slice = one
  primary module (plus, at most, named single-file touches elsewhere —
  e.g. "one `await loadArt()` line in `core-app/internal/app.ts`").
- Slices touching disjoint modules run in **parallel**; slices touching
  the same module are **serialized** and stacked.
- Logic slices (config/world/entities/systems/save) carry full gates
  (coverage floor, ratchet). Feel/render/UI slices are polish-lane (no
  floor, everything else still gates). Decide the lane before briefing —
  it changes how much test guidance the worker needs.
- Track the plan with TaskCreate/TaskUpdate, encoding dependencies with
  `addBlocks`/`addBlockedBy`. Mark tasks complete only on a shipped PR.

## 2. Scope — yours and theirs

- **Your own scope**: run `pnpm scope <modules>` for whatever you touch
  directly. A plain re-run REPLACES scope; `--add` widens. Gotchas learned
  the hard way:
  - The guard normalizes to repo-relative paths — when it blocks and
    suggests `pnpm scope --add <path>`, use its exact suggested form.
  - Bare directory args are read as spec files (EISDIR crash) — pass
    globs: `output/**`, not `output`.
  - Out-of-repo scratch files (job tmp, memory dir) also need `--add`
    with the repo-relative `../../...` form the guard prints.
- **Worker scope**: every worker brief orders `pnpm scope <module>` before
  editing, and names the exact `--add` exceptions it may use (e.g.
  `pnpm scope --add src/modules/core-app/internal/app.ts`). A worker that
  wants scope you didn't grant must justify it in its report — treat an
  unjustified widening as a decomposition bug of yours.

## 3. Brief workers (the prompt template)

Launch each worker with the Agent tool, `isolation: "worktree"`,
`run_in_background: true`. Parallel workers MUST be in worktrees — the
`.task/` scope state is per-checkout and `pnpm pr` commits the whole
working tree.

Every brief contains, in order:

1. **Identity + rails**: "You are a worker implementing slice X. Read
   CLAUDE.md and the implementation overview first. Do not invent beyond
   this spec."
2. **Setup**: exact git commands for stacking (see §4), then "write the
   spec below into `.task/spec.md`, then `pnpm scope <module>`".
3. **The spec itself, inline** — full file paths, exact export names and
   type shapes, what to keep untouched (every `data-testid`, existing
   export signatures, save format). Never say "see the plan"; the worker
   has no other context.
4. **Consumed contracts, verbatim**: paste the exact type/signature shapes
   reported by upstream workers. This is the highest-leverage line in the
   brief — downstream slices launch from reports, not from reading code.
5. **Tests-first where a pure surface exists**; name which suites may be
   rewritten (polish-lane: "replace, don't delete") and which must pass
   unmodified.
6. **Hard constraints**: no new dependencies (default answer is no),
   module boundaries, which modules are out of bounds by name.
7. **Finish line**: `pnpm verify` AND `pnpm build` green; **3 same-cause
   verify failures → STOP and report the output** instead of hacking
   around it.
8. **Ship instructions**: PR title, branch name, base branch, draft. Note
   that `pnpm pr` has no base flag — for stacked PRs the worker pushes and
   uses `gh pr create --draft --base <branch>`.
9. **Report format**: "Report: what changed, the EXACT exported
   shape/signature (the next worker consumes it — be precise),
   verify/build status, PR URL, deviations." Ask for precision on
   whatever the next slice depends on.

## 4. Stacking and bases

- Base every branch on wherever the relevant stack sits: `gh pr list`
  first. Unmerged dependency → the worker runs
  `git fetch origin <dep-branch> && git reset --hard origin/<dep-branch>`
  and the PR bases on that branch.
- A slice depending on TWO unmerged branches resets to one and
  `git merge --no-edit origin/<other>`, PR based on the first, with a PR
  body noting "stacks on #X and #Y; merge those first". A conflict in
  `.task/spec.md` is scratch — resolve either way; any real conflict means
  STOP and report.
- Publish the final merge order as a table in your wrap-up (and to
  memory). PR numbers, not branch names, for the human.

## 5. Review worker reports

Worker reports arrive as task notifications. For each one check:

- **Gates**: verify AND build both reported green? A report without both
  is not done.
- **Contract drift**: does the exported shape match what you promised the
  next worker? If it drifted, update the downstream brief before launch —
  never let two workers discover the mismatch in CI.
- **Deviations section**: read it word by word. Good workers deviate for
  good reasons (a backdrop that would block canvas clicks; a knip-driven
  export decision); your job is deciding whether the deviation leaks into
  other slices.
- **Scope confessions**: any `--add` beyond the brief must be justified
  (a test-file import breaking typecheck is fine; production code in an
  out-of-bounds module is not).
- Relay the substance to the human in your own text — the notification
  is invisible to them.

## 6. Integration check (before handing over)

Individually-green slices can still collide. Before the final report:

1. Local `integration-check` branch off main; merge every slice branch in
   the planned order. Watch for conflicts in shared files (two slices
   touching `core-app/internal/app.ts` is the classic).
2. `pnpm verify` on the merged result.
3. **Drive the real app** — `pnpm dev` + a browser. If the Chrome
   extension is not connected, headless works:
   `google-chrome --headless=new --screenshot=... <url>` for a static
   look, or a small CDP script over vite's vendored `ws`
   (`node_modules/.pnpm/ws@*`) to click through auth/story and reach the
   game. If `.env.local` exists the default dev server uses REAL
   gateways — run the probe instance with
   `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= pnpm dev --port <p>` so
   null in-memory gateways accept dummy credentials (sign **up**, not
   sign in). Never type real credentials anywhere.
4. Found a bug? Reproduce it **on origin/main** before blaming a slice.
   Pre-existing → record it (memory + final report), don't fix it in this
   pass. Introduced → send the owning worker back via SendMessage.
5. Delete the integration branch and temp worktrees; kill probe servers
   (`kill $(lsof -ti :<port>)` — beware `pkill -f` matching your own
   compound command).

## 7. Escalate vs decide

- Human gates named in the driving brief (style/contact-sheet approvals,
  final visual review) are real — use AskUserQuestion, and launch
  non-dependent slices in parallel while you wait.
- If the human grants autonomy ("no more checkpoints, review at the end"),
  honor it: decide, note the judgement call in the final report, keep
  moving. Record the grant in memory.
- Always escalate: a slice that seems to need an out-of-bounds change the
  human didn't order; style that won't converge after ~2 regeneration
  rounds; any tempting new dependency; a worker's 3-strike verify failure.
- A human instruction at a gate can override the driving brief (e.g.
  ordering a game-logic mechanic mid-polish-pass). Say explicitly that
  you're treating it as an override, add the slice, and write the decision
  to memory.

## 8. Wrap-up

The final report contains: the PR table in merge order, the mechanic /
behavior changes in the human's own vocabulary, every judgement call made
under autonomy, and pre-existing bugs found (clearly labeled repro'd-on-
main). Write the merge order and any new game rules to the project memory
before finishing — the next session starts from MEMORY.md, not from this
conversation.
