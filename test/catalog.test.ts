import assert from "node:assert/strict";
import { test } from "node:test";
import { classify } from "../src/catalog.ts";

test("AI app matched by name pattern", () => {
  const c = classify("123.apps.googleusercontent.com", "ChatGPT", ["openid"]);
  assert.equal(c.category, "ai");
  assert.equal(c.classifiedBy, "name");
  assert.equal(c.riskLevel, "low");
});

test("name matching is case-insensitive and substring-based", () => {
  const c = classify("x", "Otter.ai Meeting Notes", ["openid"]);
  assert.equal(c.category, "ai");
});

test("unknown app keeps unknown category and scope-derived risk", () => {
  const c = classify("y", "Random Tool", [
    "https://www.googleapis.com/auth/drive",
  ]);
  assert.equal(c.category, "unknown");
  assert.equal(c.classifiedBy, "unknown");
  assert.equal(c.riskLevel, "high");
});

test("risk comes from scopes even for known apps", () => {
  const c = classify("z", "Zoom", ["https://www.googleapis.com/auth/calendar"]);
  assert.equal(c.category, "communication");
  assert.equal(c.riskLevel, "medium");
});
