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
  assert.match(res.stdout, /scan/);
});

test("scan --help lists its options", () => {
  const res = run("scan", "--help");
  assert.equal(res.status, 0);
  assert.match(res.stdout, /--csv/);
  assert.match(res.stdout, /--risky/);
  assert.match(res.stdout, /--connector/);
});

test("unknown flag exits 1 with help", () => {
  const res = run("scan", "--bogus-flag");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Usage/);
});

test("unknown command exits 1 with usage", () => {
  const res = run("bogus");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /Usage/);
});

test("scan without --key exits 1 with usage", () => {
  const res = run("scan");
  assert.equal(res.status, 1);
  assert.match(res.stderr, /--key/);
});

test("scan rejects an unknown connector", () => {
  const res = run(
    "scan",
    "--connector",
    "okta",
    "--key",
    "k",
    "--impersonate",
    "a@x.com",
  );
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown connector/);
});

test("--csv with --json exits 1", () => {
  const res = run(
    "scan",
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
    "scan",
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
