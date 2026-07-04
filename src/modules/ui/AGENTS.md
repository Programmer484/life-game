# Module: ui

tasks panel, XP bar, modals, dev panel — DOM overlay

## Public surface

Import this module only through `index.ts`. Everything under `internal/` is
private — deep imports are blocked by ESLint boundaries.

## May import

- `config`
- `entities`
- `world`
- `systems`

To change what this module may import, edit `allowedImports` for `ui` in
`module-map.json`. Do not hand-edit ESLint config.

## May import (external packages)

- (nothing — pure module, no external packages)

To change which external packages this module may import, edit
`allowedExternals` for `ui` in `module-map.json` (omit the key for
unrestricted). `node:` builtins and cross-module imports are always allowed.

Polish lane: this module is exempt from the coverage floor only. Lint,
boundaries, typecheck, and knip still apply.
