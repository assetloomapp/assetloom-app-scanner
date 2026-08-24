import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type ReportMeta, renderHtml } from "../src/html.ts";
import { TEMPLATE } from "../src/html-template.generated.ts";
import type { ReportRow } from "../src/report.ts";

const META: ReportMeta = {
  connector: "google",
  generatedAt: "2026-08-19T00:00:00.000Z",
  usersScanned: 101,
  grantCount: 1871,
  errors: 0,
  riskyCount: 7,
  filters: [],
};

function row(over: Partial<ReportRow>): ReportRow {
  return {
    client_id: "c1",
    display_name: "ChatGPT",
    category: "ai",
    risk_level: "low",
    classified_by: "name",
    user_count: 3,
    ...over,
  };
}

test("generated template is in sync with templates/report.html (else run `pnpm gen`)", () => {
  const file = readFileSync(
    new URL("../templates/report.html", import.meta.url),
    "utf8",
  );
  // same light-minify transform as scripts/embed-template.ts
  const min = file
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{2,}/g, "\n");
  assert.equal(TEMPLATE, min);
});

test("embeds rows as parseable JSON and shows meta counts", () => {
  const rows = [
    row({}),
    row({ client_id: "c2", display_name: "Random Tool", risk_level: "high" }),
  ];
  const html = renderHtml(rows, META);
  const m = html.match(
    /<script id="data" type="application\/json">([\s\S]*?)<\/script>/,
  );
  assert.ok(m);
  assert.deepEqual(JSON.parse(m[1]), rows);
  assert.match(html, />101</);
  assert.match(html, />1871</);
  assert.match(html, />7</);
  // UTC ISO lands in the datetime attribute; the client localizes it
  assert.match(html, /datetime="2026-08-19T00:00:00\.000Z"/);
});

test("malicious display name cannot break out of the data script block", () => {
  const evil = "</script><script>alert(1)</script>";
  const html = renderHtml([row({ display_name: evil })], META);
  // the raw payload must never appear; "<" is escaped to \u003c inside the JSON
  assert.ok(!html.includes(evil));
  assert.ok(html.includes("\\u003c/script"));
});
