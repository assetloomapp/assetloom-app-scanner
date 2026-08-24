# Contributing

Thanks for helping out. Keep it small and simple — this project is deliberately minimal.

## Dev setup

```bash
pnpm install
pnpm test        # node:test suite, fixtures only, no network
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome
pnpm format      # biome, writes
```

Node 26+ runs the TypeScript sources directly — there is no build step. After editing `templates/report.html`, run `pnpm gen`.

## Ground rules

* Stdlib first: `node:util.parseArgs` for CLI parsing, `node:test` for tests. No new runtime dependencies without prior approval in an issue.
* Everything except `src/cli.ts` must stay importable as a library.
* Log through `src/log.ts`; stdout carries only command results so pipelines stay clean.
* Scan results are never persisted — do not add caching or storage.

## Catalog entries (`src/catalog/apps.ts`)

`clients` entries must be **vendor-published** OAuth client IDs, each with a comment citing the vendor source (docs, source code, or the vendor's own login page). A catalog match exempts an app from `--risky`, so the citation is the trust anchor. Tenant-observed IDs belong in your own copy, not upstream. Run `node scripts/verify-catalog.ts` after changing entries. See `docs/dev/categorize.md` for the full model.

## Pull requests

One focused change per PR, with a test where behavior changed. Make sure `pnpm test`, `pnpm typecheck`, and `pnpm lint` pass.
