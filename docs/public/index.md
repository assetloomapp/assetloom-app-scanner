---
title: AssetLoom App Scanner
description: Scan your Google Workspace for the third-party OAuth apps your users have granted access to — every app, every permission, every user.
template: splash
hero:
  tagline: Find every third-party app your users granted OAuth access to — which AI tools are in use, and which unknown apps hold dangerous permissions like full Gmail or Drive access. Nothing is stored; results live only in your terminal.
  actions:
    - text: Get started
      link: ./quick-guide/
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/assetloomapp/assetloom-app-scanner
      icon: external
      variant: minimal
---

## Why

Employees connect SaaS and AI tools to their work Google accounts every day. Each "Sign in with Google" grant can carry scopes as broad as full Gmail or Drive access, and most tenants have no inventory of them. AssetLoom App Scanner builds that inventory in one command.

## What you get

- **Every OAuth grant** across your tenant: app, permissions, user count.
- **AI app detection** — see which AI tools your organization actually uses.
- **Risk flagging** — unverified apps holding high-risk scopes, based on the scopes themselves, not the app's self-chosen name.
- **Your data stays yours** — results are never persisted or sent anywhere; the only network calls are to Google's Admin SDK.

```bash
assetloom-app-scanner scan --key sa.json --impersonate admin@example.com
```

**[Get started →](./quick-guide/)**
