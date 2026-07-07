# Module: coach

Goal & reflection chat: system prompts for the two coach modes, stateful
conversation sessions, and the Anthropic API transport.

## Public surface

Import this module only through `index.ts`. Everything under `internal/` is
private — deep imports are blocked by ESLint boundaries.

## May import

- (nothing — leaf module)

To change what this module may import, edit `allowedImports` for `coach` in
`module-map.json`. Do not hand-edit ESLint config.

## May import (external packages)

- `@anthropic-ai/sdk`
- `vitest`
- `fast-check`

To change which external packages this module may import, edit
`allowedExternals` for `coach` in `module-map.json` (omit the key for
unrestricted). `node:` builtins and cross-module imports are always allowed.
