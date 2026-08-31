---
title: Microsoft Entra ID
description: One-time app registration setup, guided by the config command.
---

The Entra scan reads delegated OAuth consent grants (Microsoft Graph `oauth2PermissionGrants`), so rows carry the consented permission scopes and scope-based flags (`--risky`, `--fail-on-risky`) apply. Grants an admin consented for the whole tenant appear as a single `all users (admin consent)` row.

One-time setup in the [Entra admin center](https://entra.microsoft.com):

1. **Entra ID** → **App registrations → New registration.** Name it (e.g. `assetloom-app-scanner`), leave the defaults, register.
2. **API permissions → Add a permission → Microsoft Graph → Application permissions.** Add `Directory.Read.All` (read-only; covers service principals, permission grants, and users), then click **Grant admin consent**.
3. **Certificates & secrets → New client secret.** Copy the secret **Value** (shown once).

Then run:

```bash
assetloom-app-scanner config entra
```

It asks for the tenant ID (or primary domain), the application (client) ID, and the secret value, verifies them with one Graph call, and asks where to save (default `~/.assetloom-scanner/entra.json`, so scans can omit `--key`).

National clouds (Azure Government, 21Vianet) use different endpoints — add `"loginUrl"` and `"graphUrl"` to the saved JSON file to override the defaults (`https://login.microsoftonline.com`, `https://graph.microsoft.com`).
