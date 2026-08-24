# AssetLoom App Scanner

AssetLoom App Scanner scans your Google Workspace tenant for the third-party apps your users have granted OAuth access to — every app, every permission, every user. Results print straight to your terminal and nothing is stored: which AI tools are in use, and which unknown apps hold dangerous permissions like full Gmail or Drive access. Requires Node 26+.

## Google Workspace setup

The scanner authenticates as a service account with domain-wide delegation, impersonating an admin. One-time setup:

1. In the [Google Cloud console](https://console.cloud.google.com/), create (or pick) a project and enable the **Admin SDK API**.
2. Create a **service account** (no roles needed) and download its JSON key.
3. Copy the service account's **Client ID** from its details page.
4. In the [Google Admin console](https://admin.google.com/), go to Security → Access and data control → API controls → **Domain-wide delegation** → Add new. Paste the Client ID and authorize exactly these scopes:

   ```text
   https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.user.security
   ```

## Install

Download the single binary for your platform from the [latest release](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest) — no runtime required. Alternatively, clone the repo and run from source with Node 26+ (`node src/cli.ts`).

## Usage

```bash
assetloom-app-scanner scan --key sa.json --impersonate admin@example.com   # table of all apps
assetloom-app-scanner scan ... --ai       # AI apps only
assetloom-app-scanner scan ... --risky    # unverified apps holding high-risk scopes
assetloom-app-scanner scan ... --json     # machine-readable
assetloom-app-scanner scan ... --csv      # write ./data/reports/<name>-<timestamp>.csv, path on stdout
assetloom-app-scanner scan ... --html     # self-contained HTML report (works offline, shareable)
```

`scan` also accepts `--domain example.com` to scan a specific domain, `--connector` (default and currently only option: `google`), `--user email` to filter to one user's grants, and `--fail-on-risky` to exit with code 2 when any unverified high-risk apps exist (for CI or cron alerting). Global flags: `--verbose`, `--quiet`, and `--help` — run `assetloom-app-scanner scan --help` for the full list.

## Development

```bash
pnpm install
pnpm test        # node:test suite (fixtures, no network)
pnpm typecheck   # tsc --noEmit
pnpm gen         # refresh src/html-template.generated.ts after editing templates/report.html
pnpm build       # compile single binary to dist/assetloom-app-scanner (requires bun)
pnpm build:sea   # same via Node SEA to dist/assetloom-app-scanner-sea (bigger; real Node runtime)
node src/cli.ts --help
```

No build step — Node 26 runs the TypeScript sources directly.

## Docs

Public documentation lives in [`docs/public/`](docs/public/) and is rendered by the Astro Starlight site in [`website/`](website/) (`pnpm --filter website dev`). Contributor docs live in [`docs/dev/`](docs/dev/).

## How risk is decided

Risk comes from the OAuth scopes an app holds: full Gmail, full Drive, mail-forwarding settings, and admin scopes are high; readonly variants are medium. An app is flagged risky when it holds high-risk scopes **and** is not verified by client ID in the catalog. Display-name matching only assigns a category — names are chosen by the app itself, so a name match never exempts an app from the risky report.

## License

Copyright (C) 2026 AssetLoom.com. Licensed under the [GNU AGPLv3](LICENSE).

## Data & privacy

Nothing is persisted: results exist only in memory while the command runs. The only file ever written is a CSV export you explicitly request with `--csv` (under `./data/reports/`). Nothing is sent anywhere except the Google Admin SDK calls that perform the scan.
