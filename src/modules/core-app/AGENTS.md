# Module: core-app

Pixi Application bootstrap (v8 async init), ticker, resize, scene switching

## Public surface

Import this module only through `index.ts`. Everything under `internal/` is
private — deep imports are blocked by ESLint boundaries.

## May import

- `config`
- `world`
- `entities`
- `systems`
- `render`
- `ui`
- `save`
- `core-viewport`
- `assets`

To change what this module may import, edit `allowedImports` for `core-app` in
`module-map.json`. Do not hand-edit ESLint config.

## May import (external packages)

- `pixi.js`

To change which external packages this module may import, edit
`allowedExternals` for `core-app` in `module-map.json` (omit the key for
unrestricted). `node:` builtins and cross-module imports are always allowed.
