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

* `--key` defaults to `~/.assetloom-scanner/google.json` — save your service account key there to omit the flag.
* `--domain example.com` — scan a specific domain instead of the whole customer.
* `--user email` — filter to one user's grants.
* `--fail-on-risky` — exit with code 2 when any unverified high-risk apps exist, for CI or cron alerting.

Global flags: `--verbose`, `--quiet`, `--help`, and `--version`/`-v`. Run `assetloom-app-scanner google --help` for the full list.

## Okta

Okta apps are SSO assignments, not OAuth consent grants, so rows carry no permission scopes — the scan shows which apps are connected and who is assigned, with AI detection by app name. Scope-based flags (`--risky`, `--fail-on-risky`) do not apply.

1. Create the credentials file:

```bash
assetloom-app-scanner config okta
```

It asks for your org URL (paste anything from your Okta tab — subdomain, org URL, or an Admin Console URL), points you to the exact [API token page](https://help.okta.com/en-us/content/topics/security/api.htm#security-api__create-okta-api-token) for your org (read-only admin is enough), verifies the pasted token with one API call, and asks where to save (default `~/.assetloom-scanner/okta.json`).

1. Scan:

```bash
assetloom-app-scanner okta          # every SSO-connected app with user counts
assetloom-app-scanner okta --ai     # AI apps only
```

`okta` accepts the same `--user`, `--json`, `--csv`, and `--html` flags as `google`.

The `entra` command is reserved for the upcoming Microsoft Entra ID connector.
