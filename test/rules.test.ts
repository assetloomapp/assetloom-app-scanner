import assert from "node:assert/strict";
import { test } from "node:test";
import { maxRisk, scopeRisk } from "../src/rules.ts";

test("full gmail access is high risk", () => {
  assert.equal(scopeRisk("https://mail.google.com/"), "high");
});

test("trailing-slash variants score identically", () => {
  assert.equal(scopeRisk("https://mail.google.com"), "high");
  assert.equal(scopeRisk("https://www.googleapis.com/auth/drive/"), "high");
});

test("mail forwarding settings scope is high risk", () => {
  assert.equal(
    scopeRisk("https://www.googleapis.com/auth/gmail.settings.sharing"),
    "high",
  );
});

test("full drive access is high risk", () => {
  assert.equal(scopeRisk("https://www.googleapis.com/auth/drive"), "high");
});

test("any admin scope is high risk", () => {
  assert.equal(
    scopeRisk("https://www.googleapis.com/auth/admin.directory.user"),
    "high",
  );
});

test("readonly variants are medium risk", () => {
  assert.equal(
    scopeRisk("https://www.googleapis.com/auth/gmail.readonly"),
    "medium",
  );
  assert.equal(
    scopeRisk("https://www.googleapis.com/auth/drive.readonly"),
    "medium",
  );
});

test("identity scopes are low risk", () => {
  assert.equal(scopeRisk("openid"), "low");
  assert.equal(
    scopeRisk("https://www.googleapis.com/auth/userinfo.email"),
    "low",
  );
});

test("per-file drive access is low risk", () => {
  assert.equal(scopeRisk("https://www.googleapis.com/auth/drive.file"), "low");
});

test("Graph mailbox and directory write scopes are high risk", () => {
  assert.equal(scopeRisk("Mail.ReadWrite"), "high");
  assert.equal(scopeRisk("EWS.AccessAsUser.All"), "high");
  assert.equal(scopeRisk("Directory.ReadWrite.All"), "high");
});

test("Graph read-only scopes are medium risk", () => {
  assert.equal(scopeRisk("Mail.Read"), "medium");
  assert.equal(scopeRisk("Files.Read.All"), "medium");
});

test("Graph sign-in scopes are low risk", () => {
  assert.equal(scopeRisk("User.Read"), "low");
  assert.equal(scopeRisk("profile"), "low");
});

test("maxRisk returns the highest risk present", () => {
  assert.equal(
    maxRisk(["openid", "https://www.googleapis.com/auth/drive"]),
    "high",
  );
  assert.equal(
    maxRisk(["openid", "https://www.googleapis.com/auth/calendar"]),
    "medium",
  );
  assert.equal(maxRisk(["openid"]), "low");
  assert.equal(maxRisk([]), "low");
});
