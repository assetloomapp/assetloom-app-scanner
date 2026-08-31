# Adding a new connector

A connector fetches grants from one identity provider and normalizes them into the shared `Grant`/`ScanResult` types (`src/connectors/types.ts`). Everything downstream — classification, filtering, table/JSON/CSV/HTML output — is connector-agnostic and already done. There is deliberately no `Connector` interface; the normalized types are the contract. Use `src/connectors/okta.ts` as the reference implementation; `google.ts` shows the SDK-based variant.

## 1. Write the connector (`src/connectors/<name>.ts`)

- **Client factory**: `create<Name>Client(keyFile)` reads the credentials JSON from `--key` and returns a thin client. Prefer plain `fetch` over an SDK (see the AGENTS.md dependency rules — new runtime deps need approval). Attach `status` to thrown HTTP errors so `withRetry` can retry 429/5xx.
- **Scan function**: `scan<Name>(client, opts) => Promise<ScanResult>` where `opts` is `{ concurrency?, log?, progress? }`.
  - Paginate everything (Okta: opaque `Link: rel="next"` header; Google: `pageToken`).
  - Fan out per-user/per-app calls with `mapLimit` (default concurrency 10) and wrap each call in `withRetry` — both from `src/utils.ts`.
  - A failure for one user/app increments `errors` and continues; never abort the scan.
  - Emit one `Grant` per (app, user). `clientId` should be the provider's stable OAuth client id when one exists (that is what the catalog matches on); fall back to a provider-specific id. If the provider has no consent scopes (like Okta SSO assignments), use `scopes: []` — classification falls back to name matching.
- **Input normalization helpers** (org URLs, tenant ids) live in the connector and are exported for tests — see `normalizeOrgUrl`/`adminTokenUrl` in okta.ts.
- Log only through the injected `log` callback; the library must stay importable without CLI side effects.

## 2. Wire the CLI (`src/cli.ts`)

- Add a command entry to the `COMMANDS` table. Spread `...OUTPUT_OPTIONS` and add connector-specific flags only. `--help` is generated from the table — never hand-write usage text.
- `--key` defaults to `${KEY_DIR}/<name>.json` (expanded via `expandHome`); resolve it with `keyFile(v, "<name>", "<hint>")` so a missing file fails fast with a helpful hint.
- The command body is thin: `checkOutputFlags` → create client → `scan<Name>(...)` with `progressRenderer()` → `report(v, result, "<name>")`. `report()` owns all output and exit codes.
- If credentials need assembling (tokens, org URLs), add a `"config <name>"` command modeled on `configOktaCmd`: prompt with `lineReader()` (stderr prompts, works piped), hide secrets on a TTY with `askSecretTty`, verify with one cheap API call and translate 401/403 into human messages, `confirmOverwrite`, write with `mode: 0o600`. Skip it when the provider already hands the user a file (Google) — then a validate-and-copy flow like `configGoogleCmd` is enough.

## 3. Test (`test/<name>.test.ts` + fixtures)

Plain `node:test`, no mocking frameworks:

- Unit-test the scan against a fake client object backed by fixture JSON pages (`test/fixtures/<name>-*.json`). Cover: pagination, grant normalization, user dedupe, per-item error tolerance, and any URL/id normalization helpers.
- CLI end-to-end tests in `test/cli.test.ts` spawn the real CLI against a local `node:http` fake server (see `fakeOkta()`); pipe prompt answers via stdin and pin `HOME` to a temp dir when default paths are involved.

TDD is the house style: fixtures and failing tests first, then the connector.

## 4. Docs

- `docs/public/setup/<name>.md`: one-time credential setup, including any provider quirks (e.g. Okta rows have no scopes). Add the page to the sidebar in `website/astro.config.mjs`.
- `docs/public/quick-guide.md`: add the connector to the setup list in step 2 and a one-line scan example.

## Checklist before committing

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format
```

Scan output is never persisted (see AGENTS.md): grants live in memory for the run; the only files written are reports under `./data/reports/` and credential files the user explicitly creates via `config`.
