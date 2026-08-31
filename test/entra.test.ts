import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createEntraClient,
  type EntraClient,
  scanEntra,
} from "../src/connectors/entra.ts";

const grantPages = JSON.parse(
  readFileSync(
    new URL("./fixtures/entra-grants.json", import.meta.url),
    "utf8",
  ),
);
const spById = JSON.parse(
  readFileSync(
    new URL("./fixtures/entra-service-principals.json", import.meta.url),
    "utf8",
  ),
);
const usersById = JSON.parse(
  readFileSync(new URL("./fixtures/entra-users.json", import.meta.url), "utf8"),
);

function fakeClient(): EntraClient {
  return {
    get: async (path: string) => {
      const url = new URL(path, "https://graph.example");
      if (url.pathname === "/v1.0/oauth2PermissionGrants") {
        const page = Number(url.searchParams.get("page") ?? 0);
        return {
          value: grantPages[page],
          ...(page + 1 < grantPages.length
            ? {
                "@odata.nextLink": `https://graph.example/v1.0/oauth2PermissionGrants?page=${page + 1}`,
              }
            : {}),
        };
      }
      const sp = url.pathname.match(/^\/v1\.0\/servicePrincipals\/([^/]+)$/);
      if (sp) {
        const rec = spById[sp[1]];
        if (!rec) throw Object.assign(new Error("forbidden"), { status: 403 });
        return rec;
      }
      const user = url.pathname.match(/^\/v1\.0\/users\/([^/]+)$/);
      if (user) {
        const rec = usersById[user[1]];
        if (!rec) throw Object.assign(new Error("not found"), { status: 404 });
        return rec;
      }
      throw new Error(`unexpected path: ${path}`);
    },
  };
}

test("scanEntra paginates grants, resolves apps and users, tolerates per-item failures", async () => {
  const ticks: Array<[number, number]> = [];
  const result = await scanEntra(fakeClient(), {
    log: () => {},
    progress: (done, total) => ticks.push([done, total]),
  });

  // 3 service principals + 3 distinct users to resolve
  assert.deepEqual(ticks.map(([done]) => done).sort(), [1, 2, 3, 4, 5, 6]);
  assert.ok(ticks.every(([, total]) => total === 6));

  // only resolvable users are recorded; u-missing falls back on the grant
  assert.deepEqual(
    [...result.users].sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: "u1", email: "alice@example.com" },
      { id: "u2", email: "bob@example.com" },
    ],
  );

  assert.equal(result.grants.length, 5);
  const byId = (userId: string, clientId: string) =>
    result.grants.find(
      (g) => g.userId === userId && g.app.clientId === clientId,
    );

  // Principal grant: app resolved to its global appId, scope string split
  assert.deepEqual(byId("u1", "chatgpt-app-id"), {
    userId: "u1",
    userEmail: "alice@example.com",
    app: { clientId: "chatgpt-app-id", displayName: "ChatGPT" },
    scopes: ["openid", "profile", "Mail.ReadWrite"],
  });

  // AllPrincipals (admin consent) becomes a single pseudo-user grant
  assert.deepEqual(byId("all-users", "contoso-sync-app-id"), {
    userId: "all-users",
    userEmail: "all users (admin consent)",
    app: { clientId: "contoso-sync-app-id", displayName: "Contoso Sync" },
    scopes: ["User.Read"],
  });

  // unresolvable service principal falls back to its object id
  assert.deepEqual(byId("u1", "sp-missing"), {
    userId: "u1",
    userEmail: "alice@example.com",
    app: { clientId: "sp-missing", displayName: "sp-missing" },
    scopes: [],
  });

  // unresolvable user falls back to its id
  assert.deepEqual(byId("u-missing", "contoso-sync-app-id"), {
    userId: "u-missing",
    userEmail: "u-missing",
    app: { clientId: "contoso-sync-app-id", displayName: "Contoso Sync" },
    scopes: ["Files.Read.All"],
  });

  assert.equal(result.errors, 2); // sp-missing 403 + u-missing 404
});

test("createEntraClient rejects a key file missing tenant, clientId, or clientSecret", () => {
  const key = join(tmpdir(), `entra-key-${process.pid}.json`);
  writeFileSync(key, JSON.stringify({ tenant: "t", clientId: "c" }));
  assert.throws(() => createEntraClient(key), /clientSecret/);
});
