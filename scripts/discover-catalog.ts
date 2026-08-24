// Reads Google client IDs off vendors' login pages, for catalog citations.
//
//   node scripts/discover-catalog.ts <scan.csv> --site <login-url> [--site ...]
//
// The "Sign in with Google" flow served from the vendor's own domain carries
// its client ID, so a hit binds ID → vendor (anchored by the vendor's TLS
// domain). Each site is first fetched plainly; when the ID is not in the HTML
// (JS-loaded, bot wall) a headed browser opens instead — MANUAL mode: you
// click the Google button yourself, the script polls every open tab/popup
// once a second for client_id= in the URL, records it, and moves to the next
// site. Close all its tabs to skip a site.
//
// Add findings to src/catalog/apps.ts with the login URL as the citation
// comment, then run scripts/verify-catalog.ts.
// ponytail: automated clicking (find the Google button ourselves) not built
// yet — add an --auto mode if manual rounds get tedious.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { clients } from "../src/catalog/apps.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { site: { type: "string", multiple: true } },
});
if (!positionals[0] || !values.site?.length) {
  console.log(
    "usage: node scripts/discover-catalog.ts <scan.csv> --site <login-url> [--site ...]",
  );
  process.exit(1);
}
const csv = readFileSync(positionals[0], "utf8").trim().split("\n").slice(1);
// client_id is the first CSV field and never quoted; display_name may be
// quoted, good enough for display
const known = new Map(csv.map((l) => [l.split(",")[0], l.split(",")[1]]));

const ID_RE = /[0-9]+(?:-[a-z0-9]+)?\.apps\.googleusercontent\.com/g;

function report(site: string, ids: string[], how: string) {
  for (const id of ids) {
    const seen = known.has(id) ? ` — in scan as "${known.get(id)}"` : "";
    const dup = clients[id] ? " — already in catalog" : "";
    console.log(`✓ ${site} (${how})\n    ${id}${seen}${dup}`);
  }
}

async function tryFetch(site: string): Promise<string[]> {
  try {
    const res = await fetch(site, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh)" },
    });
    return [...new Set((await res.text()).match(ID_RE) ?? [])];
  } catch {
    return [];
  }
}

// sites the plain fetch could not resolve get the manual browser round
const needBrowser: string[] = [];
for (const site of values.site) {
  const found = await tryFetch(site);
  if (found.length) report(site, found, "fetch");
  else needBrowser.push(site);
}

if (needBrowser.length) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  for (const site of needBrowser) {
    const page = await ctx.newPage();
    console.log(
      `\n→ ${site}\n  Click the Google sign-in button; watching all tabs for client_id... (close the tab to skip)`,
    );
    await page.goto(site).catch((e) => console.log(`  (load error: ${e})`));
    const found = await new Promise<string | null>((resolve) => {
      const timer = setInterval(() => {
        const pages = ctx.pages();
        if (pages.length === 0) {
          clearInterval(timer);
          resolve(null);
          return;
        }
        for (const p of pages) {
          const m = decodeURIComponent(p.url()).match(
            /client_id=([0-9]+(?:-[a-z0-9]+)?\.apps\.googleusercontent\.com)/,
          );
          if (m) {
            clearInterval(timer);
            resolve(m[1]);
            return;
          }
        }
      }, 1000);
    });
    if (found) report(site, [found], "browser");
    else console.log(`✗ ${site}: skipped`);
    for (const p of ctx.pages()) await p.close();
  }
  await browser.close();
}
