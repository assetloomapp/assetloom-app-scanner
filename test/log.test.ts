import assert from "node:assert/strict";
import { test } from "node:test";
import { log, setLogLevel } from "../src/log.ts";

function capture(fn: () => void): string[] {
  const written: string[] = [];
  const orig = process.stderr.write;
  process.stderr.write = ((s: string | Uint8Array) => {
    written.push(String(s));
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = orig;
    setLogLevel("info");
  }
  return written;
}

test("default level hides debug, shows info and up", () => {
  const out = capture(() => {
    log.debug("d");
    log.info("i");
    log.error("e");
  });
  assert.equal(out.length, 2);
  assert.match(out[0], /i/);
  assert.match(out[1], /e/);
});

test("error level silences info and warn", () => {
  const out = capture(() => {
    setLogLevel("error");
    log.info("i");
    log.warn("w");
    log.error("e");
  });
  assert.equal(out.length, 1);
  assert.match(out[0], /e/);
});
