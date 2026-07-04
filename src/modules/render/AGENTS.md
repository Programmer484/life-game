# Module: render

entity state → sprites

## Public surface

Import this module only through `index.ts`. Everything under `internal/` is
private — deep imports are blocked by ESLint boundaries.

## May import

- `config`
- `entities`
- `world`
- `core-viewport`
- `assets`

To change what this module may import, edit `allowedImports` for `render` in
`module-map.json`. Do not hand-edit ESLint config.

## May import (external packages)

- `pixi.js`

To change which external packages this module may import, edit
`allowedExternals` for `render` in `module-map.json` (omit the key for
unrestricted). `node:` builtins and cross-module imports are always allowed.

Polish lane: this module is exempt from the coverage floor only. Lint,
boundaries, typecheck, and knip still apply.
