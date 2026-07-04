# Module: config

v1 contracts: shared types (tile/tree/goal/task/event) + all tunable numbers, island layout, goal templates, story text

## Public surface

Import this module only through `index.ts`. Everything under `internal/` is
private — deep imports are blocked by ESLint boundaries.

## May import

- (nothing — leaf module)

To change what this module may import, edit `allowedImports` for `config` in
`module-map.json`. Do not hand-edit ESLint config.

## May import (external packages)

- (nothing — pure module, no external packages)

To change which external packages this module may import, edit
`allowedExternals` for `config` in `module-map.json` (omit the key for
unrestricted). `node:` builtins and cross-module imports are always allowed.
