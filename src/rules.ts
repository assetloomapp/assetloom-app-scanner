import type { RiskLevel } from "./connectors/types.ts";

// Registry entries are stored WITHOUT trailing slashes; scopeRisk normalizes
// input the same way so formatting variants cannot dodge a match.
const HIGH = new Set([
  "https://mail.google.com",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.insert",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/cloud-platform",
]);

const HIGH_PREFIXES = ["https://www.googleapis.com/auth/admin."];

const MEDIUM = new Set([
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations",
]);

const ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export function scopeRisk(scope: string): RiskLevel {
  const s = scope.replace(/\/+$/, "");
  if (HIGH.has(s) || HIGH_PREFIXES.some((p) => s.startsWith(p))) return "high";
  if (MEDIUM.has(s)) return "medium";
  return "low";
}

export function maxRisk(scopes: string[]): RiskLevel {
  let max: RiskLevel = "low";
  for (const s of scopes) {
    const r = scopeRisk(s);
    if (ORDER[r] > ORDER[max]) max = r;
  }
  return max;
}
