---
title: Quick Guide
description: From zero to a full OAuth app report in three steps.
---

1. **[Install](../installation/)** the binary for your platform.
2. **[Set up Google Workspace](../setup/google-workspace/)** — a one-time service account with two read-only scopes.
3. **Scan:**

```bash
assetloom-app-scanner google --key sa.json --impersonate admin@example.com   # table of all apps
assetloom-app-scanner google ... --ai       # AI apps only
assetloom-app-scanner google ... --risky    # unverified apps holding high-risk scopes
assetloom-app-scanner google ... --json     # machine-readable
assetloom-app-scanner google ... --csv      # write ./data/reports/<name>-<timestamp>.csv, path on stdout
assetloom-app-scanner google ... --html     # self-contained HTML report (works offline, shareable)
```

## Options

`google` also accepts:

- `--domain example.com` — scan a specific domain instead of the whole customer.
- `--user email` — filter to one user's grants.
- `--fail-on-risky` — exit with code 2 when any unverified high-risk apps exist, for CI or cron alerting.

Global flags: `--verbose`, `--quiet`, `--help`, and `--version`/`-v`. Run `assetloom-app-scanner google --help` for the full list.

`entra` and `okta` commands are reserved for the upcoming Microsoft Entra ID and Okta connectors.
