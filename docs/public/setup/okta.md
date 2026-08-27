---
title: Okta
description: One-time API token setup, guided by the config command.
---

Okta apps are SSO assignments, not OAuth consent grants, so rows carry no permission scopes — the scan shows which apps are connected and who is assigned, with AI detection by app name. Scope-based flags (`--risky`, `--fail-on-risky`) do not apply.

One-time setup:

```bash
assetloom-app-scanner config okta
```

It asks for your org URL (paste anything from your Okta tab — subdomain, org URL, or an Admin Console URL), points you to the exact [API token page](https://help.okta.com/en-us/content/topics/security/api.htm#security-api__create-okta-api-token) for your org (read-only admin is enough), verifies the pasted token with one API call, and asks where to save (default `~/.assetloom-scanner/okta.json`, so scans can omit `--key`).
