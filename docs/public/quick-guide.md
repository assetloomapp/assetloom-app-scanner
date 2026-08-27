---
title: Quick Guide
description: From zero to a full OAuth app report in three steps.
---

1. **[Install](../installation/)** the binary for your platform.
2. **Set up your identity provider** — one-time, read-only access:
   * [Google Workspace](../setup/google-workspace/) — a service account with two read-only scopes.
   * [Okta](../setup/okta/) — an API token, guided by `config okta`.
3. **Scan:**

```bash
assetloom-app-scanner google --impersonate admin@example.com   # Google Workspace: table of all apps
assetloom-app-scanner okta                                     # Okta: every SSO-connected app
```

Filters and outputs work on any connector:

```bash
assetloom-app-scanner okta --ai            # AI apps only
assetloom-app-scanner google ... --risky   # unverified apps holding high-risk scopes (google only)
assetloom-app-scanner google ... --json    # machine-readable
assetloom-app-scanner okta --csv           # write ./data/reports/<name>-<timestamp>.csv, path on stdout
assetloom-app-scanner okta --html          # self-contained HTML report (works offline, shareable)
```

## Options

All connectors:

* `--key` — credentials file, defaults to `~/.assetloom-scanner/<connector>.json` (where the setup steps put it).
* `--user email` — filter to one user's grants.

`google` also accepts:

* `--domain example.com` — scan a specific domain instead of the whole customer.
* `--fail-on-risky` — exit with code 2 when any unverified high-risk apps exist, for CI or cron alerting.

Global flags: `--verbose`, `--quiet`, `--help`, and `--version`/`-v`. Run `assetloom-app-scanner <command> --help` for the full list.

The `entra` command is reserved for the upcoming Microsoft Entra ID connector.
