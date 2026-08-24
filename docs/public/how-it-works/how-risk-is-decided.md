---
title: How risk is decided
description: Risk comes from OAuth scopes; trust comes from vendor-published client IDs.
---

Every app found in a scan gets three labels:

| Label | Values | Meaning |
|---|---|---|
| `category` | `ai`, `communication`, `productivity`, `storage`, `unknown`, … | What kind of app it is |
| `risk_level` | `low`, `medium`, `high` | How dangerous its granted scopes are |
| `classified_by` | `catalog`, `name`, `unknown` | How the app was identified — and how much that can be trusted |

## Risk comes from scopes

- **High**: full Gmail, mail-forwarding settings, full Drive, contacts, `cloud-platform`, and any admin scope.
- **Medium**: readonly Gmail/Drive/contacts, Gmail metadata, calendar, basic Gmail settings, Sheets/Docs/Slides.
- **Low**: everything else (identity scopes, per-file Drive access, …).

An app's risk is the **maximum** across the scopes granted by all of its users — one user granting full Gmail marks the app high even if everyone else granted `openid` only.

## Trust comes from client IDs

OAuth client IDs are issued by the identity provider and cannot be chosen by the app, so a match against the shipped catalog of **vendor-published** client IDs is the only verified identification. Display names are chosen by the app itself — an app calling itself "Zoom Helper" gets the `communication` category, but never any benefit of the doubt.

## What `--risky` means

`--risky` flags apps where `risk_level = high` **and** the app was not verified by client ID. Only a client-ID match exempts an app, because it is the only identification an attacker cannot forge. If a genuine first-party app shows up as risky, the fix is adding its vendor-published client ID to the catalog — not weakening the rule. See [the catalog guide](https://github.com/assetloomapp/assetloom-app-scanner/blob/main/docs/dev/categorize.md) for how entries are cited and verified.
