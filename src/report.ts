import { classify } from "./catalog.ts";
import type { Grant } from "./connectors/types.ts";

export type ReportRow = {
  client_id: string;
  display_name: string;
  category: string;
  risk_level: string;
  classified_by: string;
  user_count: number;
};

export type ReportFilters = { ai?: boolean; risky?: boolean; user?: string };

/** Aggregate raw grants into one row per app, classified and filtered. */
export function buildReport(
  grants: Grant[],
  f: ReportFilters = {},
): ReportRow[] {
  const byApp = new Map<
    string,
    { name: string; scopes: Set<string>; users: Set<string> }
  >();
  for (const g of grants) {
    if (f.user && g.userEmail !== f.user) continue;
    let app = byApp.get(g.app.clientId);
    if (!app) {
      app = { name: g.app.displayName, scopes: new Set(), users: new Set() };
      byApp.set(g.app.clientId, app);
    }
    for (const s of g.scopes) app.scopes.add(s);
    app.users.add(g.userId);
  }

  const rows: ReportRow[] = [];
  for (const [clientId, app] of byApp) {
    // union of scopes across users, so risk is the app's worst case
    const c = classify(clientId, app.name, [...app.scopes]);
    if (f.ai && c.category !== "ai") continue;
    // name matches don't count as verified — display names are attacker-chosen
    if (f.risky && !(c.riskLevel === "high" && c.classifiedBy !== "catalog"))
      continue;
    rows.push({
      client_id: clientId,
      display_name: app.name,
      category: c.category,
      risk_level: c.riskLevel,
      classified_by: c.classifiedBy,
      user_count: app.users.size,
    });
  }
  rows.sort(
    (a, b) =>
      b.user_count - a.user_count ||
      a.display_name.localeCompare(b.display_name),
  );
  return rows;
}

export function toCsv(rows: ReportRow[]): string {
  const esc = (val: unknown) => {
    let s = String(val);
    // app names are third-party input; leading =+-@ would execute as a
    // formula when the CSV is opened in Excel/Sheets
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [
    "client_id,display_name,category,risk_level,classified_by,user_count",
    ...rows.map((r) =>
      [
        r.client_id,
        r.display_name,
        r.category,
        r.risk_level,
        r.classified_by,
        r.user_count,
      ]
        .map(esc)
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}
