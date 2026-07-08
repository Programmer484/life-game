# Tech-debt ledger

Any bug or limitation discovered but not fixed in the current task —
including pre-existing ones found mid-task — gets an entry here, **in the
same PR** as the task that found it. The ledger is validated by the `debt`
verify step (`pnpm debt validate`); `pnpm debt` lists the open entries.

Entry format — one heading, one metadata line, one description paragraph:

```text
## DEBT-<n>: <title>
severity: low|medium|high — module: <name|-> — found: YYYY-MM-DD — status: open|fixed|wontfix
```

One paragraph: what is wrong, where it lives, and why it was not fixed in
the task that found it.

Rules: ids are unique and never reused (removed ids stay retired; the next
entry continues the sequence); flip `status` to `fixed` (adding a
`fixed-by: <ref>` line directly under the metadata line) or `wontfix`
rather than deleting an active entry. Entries whose fix has shipped may be
pruned in a later pass — their history lives in git — while `wontfix`
entries stay, since they record still-current decisions. Retired ids so
far: DEBT-1, DEBT-2, DEBT-5, DEBT-6, DEBT-7.

## DEBT-3: _example module counts in the coverage aggregate

severity: low — module: - — found: 2026-07-05 — status: wontfix

The `_example` reference module is included in the coverage aggregate,
trivially inflating the numbers. Wontfix: the inflation is negligible and
the module is framework-owned scaffolding kept for its documentation value.

## DEBT-8: editing an existing goal's name is not persisted

severity: low — module: systems — found: 2026-07-08 — status: fixed
fixed-by: fix(ui): persist goal rename when editing a planted tree (DEBT-8)

The task editor exposes an editable goal-name field, and the edit-goal modal
shows it for already-planted trees, but `systems.updateGoalTasks(state,
goalId, tasks)` (and `game.updateGoalTasks`) intentionally take only the task
list per the PRD-E signature — so a renamed goal on an existing tree silently
keeps its old name on Save. Fixed by widening the mutation to
`updateGoalTasks(state, goalId, name, tasks)`: the name is validated
non-empty (new `invalid-name` rejection), trimmed, and set on the goal
alongside the tasks; the edit-goal modal now forwards the editor's edited
name through `onSave` so the rename persists.

## DEBT-4: save/supabase-gateways.ts is an untested-by-design thin adapter

severity: low — module: save — found: 2026-07-05 — status: wontfix

src/modules/save/internal/supabase-gateways.ts sits at ~5% coverage as a
deliberately thin adapter over supabase-js. Wontfix while it stays
shell-thin: testing it would mock the SDK end to end for no logic gain;
promote to tested code if logic ever accumulates there.
