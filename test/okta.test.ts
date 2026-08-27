import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  adminTokenUrl,
  createOktaClient,
  normalizeOrgUrl,
  type OktaClient,
  parseNextLink,
  scanOkta,
} from "../src/connectors/okta.ts";

const appPages = JSON.parse(
  readFileSync(new URL("./fixtures/okta-apps.json", import.meta.url), "utf8"),
);
const userPagesByApp = JSON.parse(
  readFileSync(
    new URL("./fixtures/okta-app-users.json", import.meta.url),
    "utf8",
  ),
);

function fakeClient(): OktaClient {
  return {
    get: async (path: string) => {
      const appUsers = path.match(/^\/api\/v1\/apps\/([^/]+)\/users/);
      if (appUsers) {
        const [, appId] = appUsers;
        const pages = userPagesByApp[appId];
        if (!pages)
          throw Object.assign(new Error("forbidden"), { status: 403 });
        const page = Number(
          new URL(path, "https://x").searchParams.get("after") ?? 0,
        );
        return {
          data: pages[page],
          next:
            page + 1 < pages.length
              ? `/api/v1/apps/${appId}/users?after=${page + 1}`
              : undefined,
        };
      }
      const page = Number(
        new URL(path, "https://x").searchParams.get("after") ?? 0,
      );
      return {
        data: appPages[page],
        next:
          page + 1 < appPages.length
            ? `/api/v1/apps?after=${page + 1}`
            : undefined,
      };
    },
  };
}

test("scanOkta paginates apps and users, normalizes grants, counts per-app errors", async () => {
  const ticks: Array<[number, number, string]> = [];
  const result = await scanOkta(fakeClient(), {
    log: () => {},
    progress: (done, total, label) => ticks.push([done, total, label]),
  });
  assert.deepEqual(ticks.map(([done]) => done).sort(), [1, 2, 3]);
  assert.ok(ticks.every(([, total]) => total === 3));

  // u1 appears in two apps but is one user; u3 has no userName
  assert.equal(result.users.length, 3);
  assert.deepEqual(
    [...result.users].sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: "u1", email: "alice@example.com" },
      { id: "u2", email: "bob@example.com" },
      { id: "u3", email: "u3" },
    ],
  );

  assert.equal(result.grants.length, 4);
  const sorted = [...result.grants].sort(
    (a, b) =>
      a.app.clientId.localeCompare(b.app.clientId) ||
      a.userId.localeCompare(b.userId),
  );
  // OIDC app uses its oauth client_id; SAML app falls back to the app id
  assert.deepEqual(sorted[0], {
    userId: "u1",
    userEmail: "alice@example.com",
    app: { clientId: "app2", displayName: "Slack" },
    scopes: [],
  });
  assert.deepEqual(sorted[2], {
    userId: "u1",
    userEmail: "alice@example.com",
    app: { clientId: "chatgpt-client-id", displayName: "ChatGPT" },
    scopes: [],
  });

  assert.equal(result.errors, 1); // app3 threw 403; scan continued
});

test("parseNextLink extracts the next URL from an Okta Link header", () => {
  assert.equal(
    parseNextLink(
      '<https://acme.okta.com/api/v1/apps?limit=200>; rel="self", <https://acme.okta.com/api/v1/apps?after=abc&limit=200>; rel="next"',
    ),
    "https://acme.okta.com/api/v1/apps?after=abc&limit=200",
  );
  assert.equal(
    parseNextLink('<https://acme.okta.com/api/v1/apps>; rel="self"'),
    undefined,
  );
  assert.equal(parseNextLink(null), undefined);
});

test("normalizeOrgUrl keeps only the org origin and strips the -admin suffix", () => {
  assert.equal(
    normalizeOrgUrl(
      "https://integrator-8534885-admin.okta.com/admin/access/api/tokens",
    ),
    "https://integrator-8534885.okta.com",
  );
  assert.equal(
    normalizeOrgUrl("https://acme.okta.com/"),
    "https://acme.okta.com",
  );
  assert.equal(
    normalizeOrgUrl("https://integrator-8534885-admin.okta.com/"),
    "https://integrator-8534885.okta.com",
  );
  assert.equal(normalizeOrgUrl("acme.okta.com"), "https://acme.okta.com");
  assert.equal(
    normalizeOrgUrl("https://dev-123-admin.oktapreview.com"),
    "https://dev-123.oktapreview.com",
  );
  // a bare subdomain is an okta.com tenant
  assert.equal(
    normalizeOrgUrl("integrator-8534885"),
    "https://integrator-8534885.okta.com",
  );
  // custom domains pass through untouched
  assert.equal(
    normalizeOrgUrl("https://id.example.com"),
    "https://id.example.com",
  );
  assert.throws(() => normalizeOrgUrl("not a url"), /org URL/i);
});

test("adminTokenUrl points at the Admin Console token page", () => {
  assert.equal(
    adminTokenUrl("https://integrator-8534885.okta.com"),
    "https://integrator-8534885-admin.okta.com/admin/access/api/tokens",
  );
  assert.equal(
    adminTokenUrl("https://dev-123.oktapreview.com"),
    "https://dev-123-admin.oktapreview.com/admin/access/api/tokens",
  );
  // custom domains have no derivable -admin host
  assert.equal(
    adminTokenUrl("https://id.example.com"),
    "https://id.example.com/admin/access/api/tokens",
  );
});

test("createOktaClient rejects a key file missing org or token", () => {
  const key = join(tmpdir(), `okta-key-${process.pid}.json`);
  writeFileSync(key, JSON.stringify({ org: "https://acme.okta.com" }));
  assert.throws(() => createOktaClient(key), /org.*token|token.*org/i);
});
