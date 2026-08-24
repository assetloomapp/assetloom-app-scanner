# How apps are categorized

Every OAuth app found in a scan gets three labels, computed in memory by `classify()` in `src/catalog.ts`:

| Label | Values | Meaning |
|---|---|---|
| `category` | `ai`, `communication`, `productivity`, `storage`, `unknown`, … | What kind of app it is |
| `risk_level` | `low`, `medium`, `high` | How dangerous its granted scopes are |
| `classified_by` | `catalog`, `name`, `unknown` | How we identified it — and how much we trust that |

## The classification pipeline

For each app, `classify(clientId, displayName, scopes)` runs three steps and stops at the first match:

1. **Client-ID catalog match** (`classified_by: catalog`). The app's OAuth client ID is looked up in `clients` in `src/catalog/apps.ts`. Client IDs are issued by the identity provider and cannot be chosen by the app, so this is the only *verified* identification. A catalog entry supplies the category and may carry `"reputation": "suspicious"`, which forces `risk_level` to `high` regardless of scopes.
2. **Display-name pattern match** (`classified_by: name`). The app's display name is tested against the `namePatterns` regexes in `apps.ts` (case-insensitive substring match, e.g. `chatgpt|openai` → `ai`). This assigns a category only. Display names are chosen by the app itself, so a name match is a cosmetic hint, **never** a trust decision — an app calling itself "Zoom Helper" gets the `communication` category but no benefit of the doubt.
3. **Unknown** (`classified_by: unknown`). No match; category is `unknown`.

## Risk comes from scopes, not identity

`risk_level` is computed independently of the steps above (except for the `suspicious` override), by `src/rules.ts`:

- **High**: full Gmail (`mail.google.com`, `gmail.modify/compose/send/insert`), mail-forwarding settings (`gmail.settings.sharing`), full Drive, contacts, `cloud-platform`, and any scope starting with `admin.`.
- **Medium**: readonly Gmail/Drive/contacts, Gmail metadata, calendar, basic Gmail settings, spreadsheets/documents/presentations.
- **Low**: everything else (identity scopes, per-file Drive access, …).

An app's risk is the **maximum** across the union of scopes granted by all of its users, so one user granting full Gmail marks the app high even if everyone else granted `openid` only. Scopes are normalized (trailing slashes stripped) before lookup so formatting variants cannot dodge a match.

## What `--risky` means

`--risky` flags apps where `risk_level = high` **and** `classified_by ≠ catalog`. Only a client-ID match exempts an app, because it is the only identification an attacker cannot forge. Consequence: while the `clients` catalog is empty, even genuine first-party apps (Google Cloud SDK, macOS) appear risky — the fix is adding their client IDs to the catalog, not weakening the rule.

## Adding catalog entries

Edit `src/catalog/apps.ts`:

```ts
export const clients: Record<string, CatalogEntry> = {
  // Ships in the Google Cloud SDK: lib/googlecloudsdk/core/config.py, CLOUDSDK_CLIENT_ID
  "32555940559.apps.googleusercontent.com": { name: "Google Cloud SDK", category: "google" },
};

export const namePatterns = [{ pattern: "chatgpt|openai", category: "ai" }];
```

- `clients` keys are exact OAuth client IDs. The shipped catalog accepts only **vendor-published** IDs — ones the vendor prints in its own documentation or source code — because a catalog match grants `--risky` exemption and the vendor's publication is the only binding of ID to identity that a third party can check. Every entry carries a comment citing that source. IDs confirmed only through your own admin console belong in your private copy, not upstream.
- For web apps, the citation comes from the vendor's own login page: the "Sign in with Google" flow served from the vendor's domain carries its client ID (visible in the page source or in the `client_id=` parameter of the `accounts.google.com` URL the button opens). `node scripts/discover-catalog.ts <scan.csv> --site <login-url>` automates this and cross-references the scan: it fetches each page plainly first, and for sites that inject the ID via JS or sit behind bot walls it opens a headed browser (Playwright, dev-only dependency) where you click the Google button yourself — the script polls every tab for `client_id=` and records the hit (close all its tabs to skip a site). A hit qualifies only if the URL is the vendor's real domain.
- `node scripts/verify-catalog.ts` cross-checks every `clients` entry against Google's OAuth endpoint. It is a consistency lint — the brand Google renders is developer-chosen, so it proves freshness, not identity. `VERIFIED` means Google's registered brand matches our `name`; `EXISTS` means the ID is real but exposes no brand anonymously; `MISMATCH`/`NOT_FOUND` fail the run (wrong or stale entry). Run it whenever entries change.
- `namePatterns` are regexes tried in order; keep them specific enough to avoid false positives — they affect only the category column.
- Categories are free-form strings; reuse the existing set unless a new one is genuinely needed.

Tests covering this behavior live in `test/catalog.test.ts`, `test/rules.test.ts`, and `test/report.test.ts` (including the regression test that a name match must never escape `--risky`).
