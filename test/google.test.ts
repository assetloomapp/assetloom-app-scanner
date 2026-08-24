import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { type DirectoryApi, scanDirectory } from "../src/connectors/google.ts";
import { withRetry } from "../src/utils.ts";

const userPages = JSON.parse(
  readFileSync(
    new URL("./fixtures/google-users.json", import.meta.url),
    "utf8",
  ),
);
const tokensByUser = JSON.parse(
  readFileSync(
    new URL("./fixtures/google-tokens.json", import.meta.url),
    "utf8",
  ),
);

function fakeDir(): DirectoryApi {
  let page = 0;
  return {
    users: {
      list: async () => ({ data: userPages[page++] }),
    },
    tokens: {
      list: async ({ userKey }) => {
        if (!(userKey in tokensByUser))
          throw Object.assign(new Error("forbidden"), { status: 403 });
        return { data: tokensByUser[userKey] };
      },
    },
  };
}

test("scanDirectory paginates users, normalizes grants, counts per-user errors", async () => {
  const ticks: Array<[number, number, string]> = [];
  const result = await scanDirectory(fakeDir(), {
    log: () => {},
    progress: (done, total, email) => ticks.push([done, total, email]),
  });
  // completion order varies under concurrency; done counts and emails must not
  assert.deepEqual(ticks.map(([done]) => done).sort(), [1, 2, 3]);
  assert.deepEqual(ticks.map(([, , email]) => email).sort(), [
    "alice@example.com",
    "bob@example.com",
    "carol@example.com",
  ]);
  assert.ok(ticks.every(([, total]) => total === 3));
  assert.equal(result.users.length, 3);
  assert.deepEqual(result.users[0], { id: "u1", email: "alice@example.com" });
  assert.equal(result.grants.length, 2);
  const sorted = [...result.grants].sort((a, b) =>
    a.app.clientId.localeCompare(b.app.clientId),
  );
  assert.deepEqual(sorted[0], {
    userId: "u1",
    userEmail: "alice@example.com",
    app: { clientId: "111.apps.googleusercontent.com", displayName: "ChatGPT" },
    scopes: ["openid", "https://www.googleapis.com/auth/drive.readonly"],
  });
  assert.equal(result.errors, 1); // u3 threw 403; scan continued
});

test("withRetry retries 429 then succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3)
        throw Object.assign(new Error("rate limited"), { status: 429 });
      return "ok";
    },
    async () => {},
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
});

test("withRetry does not retry a 403", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw Object.assign(new Error("forbidden"), { status: 403 });
      },
      async () => {},
    ),
    /forbidden/,
  );
  assert.equal(calls, 1);
});

test("withRetry gives up after 4 attempts", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw Object.assign(new Error("boom"), { status: 500 });
      },
      async () => {},
    ),
    /boom/,
  );
  assert.equal(calls, 4);
});
