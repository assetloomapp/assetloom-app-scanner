// Cross-checks the client IDs in src/catalog/apps.ts against Google's OAuth
// endpoint. Run from the repo root: node scripts/verify-catalog.ts
//
// This is a consistency lint (stale IDs, renames, typos), NOT proof of
// identity — the brand Google renders is developer-chosen. Trust comes from
// the vendor-source citation each catalog entry must carry.
//
// For each ID we request the authorize page with a localhost redirect:
// - installed-app clients accept localhost, and the sign-in page carries the
//   Google-verified brand in data-app-name → compared against our "name"
// - web clients reject it with redirect_uri_mismatch → the ID exists, but the
//   brand must be checked manually (consent screen or Workspace admin console)
// - unknown/deleted IDs return invalid_client / deleted_client → stale entry
import { clients } from "../src/catalog/apps.ts";
import { mapLimit } from "../src/utils.ts";

const ids = Object.keys(clients);

type Result = { id: string; status: string; detail: string };
const results: Result[] = [];

async function check(id: string): Promise<Result> {
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&scope=openid" +
    `&client_id=${encodeURIComponent(id)}` +
    `&redirect_uri=${encodeURIComponent("http://localhost:8085")}`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  const body = await res.text();
  const expected = clients[id].name;
  // redirect_uri_mismatch pages name the app "This app" — check first so web
  // clients land in EXISTS instead of a bogus brand comparison
  if (body.includes("redirect_uri_mismatch"))
    return {
      id,
      status: "EXISTS",
      detail: `web client — verify "${expected}" manually`,
    };
  // brand appears as data-app-name on sign-in pages, or in the "Access
  // blocked" heading when the client exists but rejects the loopback flow
  const brand =
    body.match(/data-app-name="([^"]*)"/)?.[1] ??
    body.match(/Access blocked: (.*?)(?:'|&#39;|’)s request is invalid/)?.[1];
  if (brand)
    return brand === expected
      ? { id, status: "VERIFIED", detail: brand }
      : {
          id,
          status: "MISMATCH",
          detail: `Google says "${brand}", catalog says "${expected}"`,
        };
  if (body.includes("invalid_client") || body.includes("deleted_client"))
    return {
      id,
      status: "NOT_FOUND",
      detail: `no such client — remove "${expected}"?`,
    };
  // first-party clients (Chrome, device sign-ins) refuse the web flow with a
  // brandless invalid_request — the ID exists but exposes nothing to compare
  if (body.includes("invalid_request"))
    return {
      id,
      status: "EXISTS",
      detail: `restricted client — verify "${expected}" manually`,
    };
  return {
    id,
    status: "UNRECOGNIZED",
    detail: `unexpected response (HTTP ${res.status})`,
  };
}

await mapLimit(ids, 4, async (id) => {
  results.push(await check(id));
});

let failed = 0;
for (const r of results.sort((a, b) => a.status.localeCompare(b.status))) {
  if (r.status === "MISMATCH" || r.status === "NOT_FOUND") failed++;
  console.log(`${r.status.padEnd(12)} ${r.id}\n             ${r.detail}`);
}
console.log(
  `\n${ids.length} checked: ${results.filter((r) => r.status === "VERIFIED").length} verified, ` +
    `${results.filter((r) => r.status === "EXISTS").length} exist (manual), ${failed} failed`,
);
process.exitCode = failed ? 1 : 0;
