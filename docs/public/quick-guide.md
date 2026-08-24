---
title: Quick Guide
description: From zero to a full OAuth app report in three steps.
---

1. **[Install](../installation/)** the binary for your platform.
2. **[Set up Google Workspace](../setup/google-workspace/)** — a one-time service account with two read-only scopes.
3. **Scan:**

```bash
assetloom-app-scanner scan --key sa.json --impersonate admin@example.com   # table of all apps
assetloom-app-scanner scan ... --ai       # AI apps only
assetloom-app-scanner scan ... --risky    # unverified apps holding high-risk scopes
assetloom-app-scanner scan ... --json     # machine-readable
assetloom-app-scanner scan ... --csv      # write ./data/reports/<name>-<timestamp>.csv, path on stdout
assetloom-app-scanner scan ... --html     # self-contained HTML report (works offline, shareable)
```

## Options

`scan` also accepts:

- `--domain example.com` — scan a specific domain instead of the whole customer.
- `--connector` — identity provider (default and currently only option: `google`).
- `--user email` — filter to one user's grants.
- `--fail-on-risky` — exit with code 2 when any unverified high-risk apps exist, for CI or cron alerting.

Global flags: `--verbose`, `--quiet`, `--help`, and `--version`/`-v`. Run `assetloom-app-scanner scan --help` for the full list.
