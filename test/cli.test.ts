import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const CLI = new URL("../src/cli.ts", import.meta.url).pathname;

function run(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
}

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

test("google without --key exits 1 with usage", () => {
  const res = run("google");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--key/);
});

test("okta exits 1 as not implemented", () => {
  const res = run("okta");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /not implemented/);
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
