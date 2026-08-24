import assert from "node:assert/strict";
import { test } from "node:test";
import type { Grant } from "../src/connectors/types.ts";
import { buildReport, toCsv } from "../src/report.ts";

function grant(
  userId: string,
  email: string,
  clientId: string,
  name: string,
  scopes: string[],
): Grant {
  return {
    userId,
    userEmail: email,
    app: { clientId, displayName: name },
    scopes,
  };
}

const GRANTS: Grant[] = [
  grant("u1", "a@x.com", "c1", "ChatGPT", ["openid"]),
  grant("u2", "b@x.com", "c1", "ChatGPT", ["openid"]),
  grant("u1", "a@x.com", "c2", "Random Tool", [
    "https://www.googleapis.com/auth/drive",
  ]),
];

test("aggregates users per app, ordered by count", () => {
  const rows = buildReport(GRANTS);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].client_id, "c1");
  assert.equal(rows[0].user_count, 2);
  assert.equal(rows[1].risk_level, "high");
  assert.equal(rows[1].classified_by, "unknown");
});

test("app risk is the max across all users of the app", () => {
  const rows = buildReport([
    grant("u1", "a@x.com", "c4", "Tool", ["openid"]),
    grant("u2", "b@x.com", "c4", "Tool", ["https://mail.google.com"]),
  ]);
  assert.equal(rows[0].risk_level, "high");
});

test("--ai filters to ai category", () => {
  assert.deepEqual(
    buildReport(GRANTS, { ai: true }).map((r) => r.client_id),
    ["c1"],
  );
});

test("--risky means not client-ID-verified AND high risk", () => {
  assert.deepEqual(
    buildReport(GRANTS, { risky: true }).map((r) => r.client_id),
    ["c2"],
  );
});

test("--risky includes high-risk apps that only name-matched", () => {
  // an app can call itself anything; a name match must not exempt it
  const grants = [
    ...GRANTS,
    grant("u1", "a@x.com", "c3", "Zoom Helper", ["https://mail.google.com"]),
  ];
  const rows = buildReport(grants, { risky: true });
  assert.deepEqual(rows.map((r) => r.client_id).sort(), ["c2", "c3"]);
});

test("--user filters by email", () => {
  const rows = buildReport(GRANTS, { user: "b@x.com" });
  assert.deepEqual(
    rows.map((r) => r.client_id),
    ["c1"],
  );
  assert.equal(rows[0].user_count, 1);
});

test("toCsv renders header and rows", () => {
  const [header, first] = toCsv(buildReport(GRANTS)).trim().split("\n");
  assert.equal(
    header,
    "client_id,display_name,category,risk_level,classified_by,user_count",
  );
  assert.equal(first, "c1,ChatGPT,ai,low,name,2");
});

test("toCsv neutralizes formula injection in app names", () => {
  const rows = buildReport([
    grant("u1", "a@x.com", "c1", '=HYPERLINK("http://evil")', ["openid"]),
  ]);
  const dataLine = toCsv(rows).trim().split("\n")[1];
  assert.match(dataLine, /'=HYPERLINK/);
});
