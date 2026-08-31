import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const CLI = new URL("../src/cli.ts", import.meta.url).pathname;

function run(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

function runWithInput(args: string[], input: string, home?: string) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(process.execPath, [CLI, ...args], {
        env: home ? { ...process.env, HOME: home } : process.env,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => {
        stdout += d;
      });
      child.stderr.on("data", (d) => {
        stderr += d;
      });
      child.stdin.write(input);
      child.stdin.end();
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    },
  );
}

async function fakeOkta() {
  const server = createServer((req, res) => {
    const ok = req.headers.authorization === "SSWS good-token";
    res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
    res.end(ok ? "[]" : '{"errorSummary":"Invalid token"}');
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { server, org: `http://127.0.0.1:${port}` };
}

test("config okta prompts for org, token, then path; a directory answer gets okta.json", async () => {
  const { server, org } = await fakeOkta();
  const dir = mkdtempSync(join(tmpdir(), "okta-config-"));
  const out = join(dir, "okta.json");
  try {
    const res = await runWithInput(
      ["config", "okta"],
      `${org}/admin/access/api/tokens\ngood-token\n${dir}\n`,
    );
    assert.equal(res.status, 0);
    assert.match(res.stderr, /\/admin\/access\/api\/tokens/); // token page suggestion
    assert.equal(res.stdout.trim(), out);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), {
      org,
      token: "good-token",
    });
    assert.equal(statSync(out).mode & 0o777, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    server.close();
  }
});

test("config okta defaults the path to ~/.assetloom-scanner/okta.json", async () => {
  const { server, org } = await fakeOkta();
  const home = mkdtempSync(join(tmpdir(), "okta-config-default-"));
  try {
    const res = await runWithInput(
      ["config", "okta"],
      `${org}\ngood-token\n\n`,
      home,
    );
    assert.equal(res.status, 0);
    const expected = join(home, ".assetloom-scanner", "okta.json");
    assert.equal(res.stdout.trim(), expected);
    assert.ok(existsSync(expected));
  } finally {
    rmSync(home, { recursive: true, force: true });
    server.close();
  }
});

test("config okta expands a ~/ answer against the home directory", async () => {
  const { server, org } = await fakeOkta();
  const home = mkdtempSync(join(tmpdir(), "okta-config-tilde-"));
  try {
    const res = await runWithInput(
      ["config", "okta"],
      `${org}\ngood-token\n~/custom.json\n`,
      home,
    );
    assert.equal(res.status, 0);
    assert.ok(existsSync(join(home, "custom.json")));
  } finally {
    rmSync(home, { recursive: true, force: true });
    server.close();
  }
});

test("config okta asks before overwriting and defaults to no", async () => {
  const { server, org } = await fakeOkta();
  const dir = mkdtempSync(join(tmpdir(), "okta-config-ow-"));
  const out = join(dir, "okta.json");
  writeFileSync(out, '{"org":"old","token":"old"}');
  try {
    // empty answer = no: abort, file untouched
    const declined = await runWithInput(
      ["config", "okta"],
      `${org}\ngood-token\n${out}\n\n`,
    );
    assert.equal(declined.status, 1);
    assert.match(declined.stderr, /Overwrite\? \(y\/N\)/);
    assert.match(readFileSync(out, "utf8"), /old/);

    // y: proceed and overwrite
    const accepted = await runWithInput(
      ["config", "okta"],
      `${org}\ngood-token\n${out}\ny\n`,
    );
    assert.equal(accepted.status, 0);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), {
      org,
      token: "good-token",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    server.close();
  }
});

test("config okta rejects a bad token and writes nothing", async () => {
  const { server, org } = await fakeOkta();
  const dir = mkdtempSync(join(tmpdir(), "okta-config-bad-"));
  const out = join(dir, "okta.json");
  try {
    const res = await runWithInput(["config", "okta"], `${org}\nbad-token\n`);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /401/);
    assert.match(res.stderr, /rejected|expired|revoked/i); // explains, not just the code
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    server.close();
  }
});

const FAKE_SA_KEY = JSON.stringify({
  type: "service_account",
  client_email: "scanner@proj.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nxx\n-----END PRIVATE KEY-----\n",
});

test("config google validates the key and copies it to the default dir", async () => {
  const home = mkdtempSync(join(tmpdir(), "google-config-"));
  const src = join(home, "downloaded-sa.json");
  writeFileSync(src, FAKE_SA_KEY);
  try {
    const res = await runWithInput(
      ["config", "google"],
      `${src}\n\n`, // empty answer = yes, copy
      home,
    );
    assert.equal(res.status, 0);
    assert.match(res.stderr, /setup\/google-workspace/); // docs link shown
    const dest = join(home, ".assetloom-scanner", "google.json");
    assert.equal(res.stdout.trim(), dest);
    assert.equal(readFileSync(dest, "utf8"), FAKE_SA_KEY);
    assert.equal(statSync(dest).mode & 0o777, 0o600);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("config google without the copy leaves the default dir alone", async () => {
  const home = mkdtempSync(join(tmpdir(), "google-config-nocopy-"));
  const src = join(home, "downloaded-sa.json");
  writeFileSync(src, FAKE_SA_KEY);
  try {
    const res = await runWithInput(["config", "google"], `${src}\nn\n`, home);
    assert.equal(res.status, 0);
    assert.equal(existsSync(join(home, ".assetloom-scanner")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("config google rejects a file that is not a service account key", async () => {
  const home = mkdtempSync(join(tmpdir(), "google-config-bad-"));
  const src = join(home, "oauth-client.json");
  writeFileSync(src, JSON.stringify({ installed: { client_id: "x" } }));
  try {
    const res = await runWithInput(["config", "google"], `${src}\n`, home);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /service account/i);
    assert.equal(existsSync(join(home, ".assetloom-scanner")), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("--help exits 0 and lists commands", () => {
  const res = run("--help");
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Usage/);
  assert.match(res.stdout, /google/);
  assert.match(res.stdout, /entra/);
  assert.match(res.stdout, /okta/);
});

test("google --help lists its options", () => {
  const res = run("google", "--help");
  assert.equal(res.status, 0);
  assert.match(res.stdout, /--csv/);
  assert.match(res.stdout, /--risky/);
});

test("unknown flag exits 1 with help", () => {
  const res = run("google", "--bogus-flag");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Usage/);
});

test("unknown command exits 1 with usage", () => {
  const res = run("bogus");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Usage/);
});

test("google without --key and no default key file explains where it looked", async () => {
  const home = mkdtempSync(join(tmpdir(), "no-key-google-"));
  try {
    const res = await runWithInput(
      ["google", "--impersonate", "a@x.com"],
      "",
      home,
    );
    assert.equal(res.status, 1);
    assert.match(res.stderr, /key file not found/);
    assert.match(res.stderr, /google\.json/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("okta without --key and no default key file points at config okta", async () => {
  const home = mkdtempSync(join(tmpdir(), "no-key-okta-"));
  try {
    const res = await runWithInput(["okta"], "", home);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /key file not found/);
    assert.match(res.stderr, /config okta/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("okta scans using the default key file from the home directory", async () => {
  const { server, org } = await fakeOkta();
  const home = mkdtempSync(join(tmpdir(), "default-key-okta-"));
  mkdirSync(join(home, ".assetloom-scanner"));
  writeFileSync(
    join(home, ".assetloom-scanner", "okta.json"),
    JSON.stringify({ org, token: "good-token" }),
  );
  try {
    const res = await runWithInput(["okta"], "", home);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /No third-party app grants found/);
  } finally {
    rmSync(home, { recursive: true, force: true });
    server.close();
  }
});

test("entra without --key and no default key file points at config entra", async () => {
  const home = mkdtempSync(join(tmpdir(), "no-key-entra-"));
  try {
    const res = await runWithInput(["entra"], "", home);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /key file not found/);
    assert.match(res.stderr, /config entra/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("entra scans using the default key file from the home directory", async () => {
  // one server plays both the token endpoint and Microsoft Graph
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url?.endsWith("/oauth2/v2.0/token")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"access_token":"tok"}');
      return;
    }
    const ok = req.headers.authorization === "Bearer tok";
    res.writeHead(ok ? 200 : 401, { "content-type": "application/json" });
    res.end(ok ? '{"value":[]}' : "{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const home = mkdtempSync(join(tmpdir(), "default-key-entra-"));
  mkdirSync(join(home, ".assetloom-scanner"));
  writeFileSync(
    join(home, ".assetloom-scanner", "entra.json"),
    JSON.stringify({
      tenant: "t1",
      clientId: "c1",
      clientSecret: "s1",
      loginUrl: base,
      graphUrl: base,
    }),
  );
  try {
    const res = await runWithInput(["entra"], "", home);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /No third-party app grants found/);
  } finally {
    rmSync(home, { recursive: true, force: true });
    server.close();
  }
});

test("okta rejects google-only flags", () => {
  const res = run("okta", "--key", "k.json", "--impersonate", "a@x.com");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /impersonate/);
});

test("--csv with --json exits 1", () => {
  const res = run(
    "google",
    "--csv",
    "--json",
    "--key",
    "k",
    "--impersonate",
    "a@x.com",
  );
  assert.equal(res.status, 1);
  assert.match(res.stderr, /mutually exclusive/);
});

test("--html with --csv exits 1", () => {
  const res = run(
    "google",
    "--html",
    "--csv",
    "--key",
    "k",
    "--impersonate",
    "a@x.com",
  );
  assert.equal(res.status, 1);
  assert.match(res.stderr, /mutually exclusive/);
});
