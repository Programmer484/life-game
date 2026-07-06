# Tech-debt ledger

Any bug or limitation discovered but not fixed in the current task —
including pre-existing ones found mid-task — gets an entry here, **in the
same PR** as the task that found it. The ledger is validated by the `debt`
verify step (`pnpm debt validate`); `pnpm debt` lists the open entries.

Entry format — one heading, one metadata line, one description paragraph:

```text
## DEBT-<n>: <title>
severity: low|medium|high — module: <name|-> — found: YYYY-MM-DD — status: open|fixed|wontfix

One paragraph: what is wrong, where it lives, and why it was not fixed in
the task that found it.
```

Rules: ids are unique and never reused; `module` is a module-map name, or `-`
for cross-cutting debt; entries are never deleted — flip `status` to `fixed`
(adding a `fixed-by: <ref>` line directly under the metadata line) or
`wontfix` instead, so the ledger stays a history.

## DEBT-1: game.ts autosave/auth path uncovered

severity: low — module: core-app — found: 2026-07-05 — status: open

Lines ~180-185 of src/modules/core-app/internal/game.ts (the autosave/auth
path) have no test coverage. Found during the 2026-07-05 framework audit;
left unfixed because exercising the path needs gateway fakes beyond the
sync task's scope.

## DEBT-2: UNLOCK_COSTS[id-2] non-null assertions encode the section layout

severity: low — module: systems — found: 2026-07-05 — status: open

`UNLOCK_COSTS[id - 2]!` non-null assertions encode the sections-2..7
convention in two places in the systems module — brittle if the island
layout ever changes shape. Left as-is because a layout-independent lookup
is a design change, not a sync-task fix.

## DEBT-3: _example module counts in the coverage aggregate

severity: low — module: - — found: 2026-07-05 — status: wontfix

The `_example` reference module is included in the coverage aggregate,
trivially inflating the numbers. Wontfix: the inflation is negligible and
the module is framework-owned scaffolding kept for its documentation value.

## DEBT-4: save/supabase-gateways.ts is an untested-by-design thin adapter

severity: low — module: save — found: 2026-07-05 — status: wontfix

src/modules/save/internal/supabase-gateways.ts sits at ~5% coverage as a
deliberately thin adapter over supabase-js. Wontfix while it stays
shell-thin: testing it would mock the SDK end to end for no logic gain;
promote to tested code if logic ever accumulates there.

## DEBT-5: Quoted redirect targets bypass the bash always-block

severity: low — module: - — found: 2026-07-05 — status: open

`echo x > '.task/allowed-files.json'` escapes the scope-guard's always-block
on the scope file and the audit ledger because quote-stripping runs before
write-operand extraction, so a quoted redirect target vanishes before it can
be matched. Accepted for now: the Bash layer is an anti-accident heuristic,
not an adversary boundary (CLAUDE.md rule 5), and every escape is logged to
edit-log.jsonl; closing it would require a real shell tokenizer.
