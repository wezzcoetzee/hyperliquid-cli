# Extract hl-cli to Repo Root for npm Publishing

## Goal

Relocate the CLI in `hl-cli/` to the root of the `hyperliquid-cli` repo, strip out the embedded HTTP server and related infra, and prepare the package for public publication on npm as `@wezzcoetzee/hyperliquid-cli`.

## Scope

### In scope
- Move CLI source (`src/commands/`, `src/lib/`, `src/index.ts`), tests, TS/vitest config, lockfile, `.env.example`, `.github/`, `.claude/`, `ARCHITECTURE.md`, `AGENTS.md`, `.gitignore` from `hl-cli/` to repo root.
- Strip the HTTP server from `src/index.ts`.
- Update `package.json` for public npm publishing.
- Rewrite `README.md` for npm consumers.
- Delete `hl-cli/` after extraction.

### Out of scope
- Changes to command behavior, lib internals, or tests.
- Git history preservation (user opted out).
- New features.

## File Operations

### Move (`hl-cli/X` → `X`)
- `src/`
- `tests/`
- `tsconfig.json`
- `vitest.config.ts`
- `package.json` (then edit)
- `package-lock.json`
- `.env.example` (then edit)
- `.gitignore`
- `.github/`
- `.claude/`
- `ARCHITECTURE.md`
- `AGENTS.md`

### Drop
- `hl-cli/Dockerfile`
- `hl-cli/docs/` (QUALITY_SCORE.md, RELIABILITY.md, SECURITY.md, design-docs/)
- `hl-cli/dist/`
- `hl-cli/node_modules/`
- `hl-cli/README.md` (replaced with new root README)

### Final state
`hl-cli/` directory removed entirely.

## Code Changes

### `src/index.ts`
Strip the HTTP server branch. Remove:
- `import { createServer } from "node:http"`
- `resolvePort()`, `resolveAuthToken()`
- All `process.env.PORT`, `process.env.HL_AUTH_TOKEN`, `process.env.HL_BIND_HOST` usage
- The `if (port) { ... } else { cli.run(); }` conditional — replace with unconditional `cli.run()`

Result: a clean CLI entry that builds the `Cli`, registers commands, and runs.

### Verification
Quick grep to confirm no command file or lib imports server-only helpers. (`process.env.PORT`/`HL_AUTH_TOKEN` should appear only in the deleted code.)

### `.env.example`
Reduce to:
```
HYPERLIQUID_PRIVATE_KEY=
```

## `package.json` Updates

- `version`: `1.0.0`
- Remove `publishConfig` block (defaults to public npm registry).
- Remove `serve` script.
- Add:
  - `description`: short summary
  - `license`: matches repo `LICENSE` (read file to confirm; likely MIT)
  - `author`: `Wesley Coetzee`
  - `repository`: `{ type: "git", url: "git+https://github.com/wezzcoetzee/hyperliquid-cli.git" }`
  - `homepage`: `https://github.com/wezzcoetzee/hyperliquid-cli#readme`
  - `bugs`: `{ url: "https://github.com/wezzcoetzee/hyperliquid-cli/issues" }`
  - `keywords`: `["hyperliquid", "cli", "trading", "perps", "dex"]`
- Replace `"latest"` in `dependencies` and `devDependencies` with the resolved versions from `package-lock.json` (caret-prefixed, e.g. `^x.y.z`). `"latest"` in published packages is unsafe — installs become non-reproducible.
- Keep `bin: { "hl": "dist/index.js" }`, `main`, `files: ["dist"]`, `type: "module"`, build scripts as-is.

## README

Rewrite as `README.md` at repo root. Sections:

1. **Title + one-line description**
2. **Install**: `npm i -g @wezzcoetzee/hyperliquid-cli`
3. **Setup**: explain `HYPERLIQUID_PRIVATE_KEY` env var (warn about key safety)
4. **Quick start**: an example `hl positions` and `hl open` invocation
5. **Commands**: one short section per command (open, close, stop-loss, take-profit, move-sl, cancel-all, set-leverage, positions, balance, orders) with synopsis of args
6. **Development**: clone, `npm install`, `npm run dev`, `npm test`, `npm run build`
7. **License**

## Verification Steps

After all changes:
1. `npm install` (at root) — clean install succeeds.
2. `npm run build` — TypeScript compiles, `dist/index.js` produced with shebang and exec bit.
3. `npm test` — vitest passes.
4. `node dist/index.js --help` — CLI prints help, lists commands.
5. `npm pack --dry-run` — inspect tarball contents: should include `dist/`, `package.json`, `README.md`, `LICENSE`; should NOT include `src/`, `tests/`, `node_modules/`.

## Risks / Notes

- **`"latest"` dep pinning**: must resolve before publishing. The lockfile has the actual resolved versions.
- **LICENSE file**: already at repo root — npm will pick it up automatically if `license` field is set in `package.json`.
- **First-time public publish**: requires `npm login` and `npm publish --access public` (since the package is scoped). This step is left to the user; the design only prepares the package.
