---
title: Google Workspace
description: One-time service account setup with domain-wide delegation.
---

The scanner authenticates as a service account with domain-wide delegation, impersonating an admin. One-time setup:

1. In the [Google Cloud console](https://console.cloud.google.com/), create (or pick) a project and enable the [Admin SDK API](https://console.cloud.google.com/marketplace/product/google/admin.googleapis.com).
2. [Create a **service account**](https://console.cloud.google.com/iam-admin/serviceaccounts) (no roles needed). On the service account's **Keys** tab, choose **Add key → Create new key → JSON** — a `.json` key file downloads to your machine. The scanner authenticates with this file.
3. Copy the service account's **Client ID** from its details page.
4. In the [Google Admin console](https://admin.google.com/), go to Security → Access and data control → API controls → **Domain-wide delegation** → Add new. Paste the Client ID and authorize exactly these scopes:

   ```text
   https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.user.security
   ```

5. Install the downloaded key:

   ```bash
   assetloom-app-scanner config google
   ```

   It validates the key file and copies it to `~/.assetloom-scanner/google.json`, so scans can omit `--key`.

Both scopes are read-only.
