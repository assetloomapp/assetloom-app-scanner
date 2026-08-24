import { TEMPLATE } from "./html-template.generated.ts";
import type { ReportRow } from "./report.ts";

export type ReportMeta = {
  connector: string;
  generatedAt: string;
  usersScanned: number;
  grantCount: number;
  errors: number;
  riskyCount: number;
  filters: string[];
};

const escapeHtml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Fill templates/report.html (embedded at codegen time) with scan results.
 * The output is a single self-contained file that works from file://.
 */
export function renderHtml(rows: ReportRow[], meta: ReportMeta): string {
  const subtitle = [
    meta.connector,
    `${meta.usersScanned} users scanned`,
    `${meta.grantCount} grants`,
    meta.errors ? `${meta.errors} user(s) failed` : "",
    meta.filters.length ? `filters: ${meta.filters.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const tokens: Record<string, string> = {
    // display names are third-party input; escaping "<" keeps a malicious
    // name like "</script><script>..." from breaking out of the data block.
    // the token carries its quotes so the template's data block stays valid
    // JSON for Biome's embedded-JSON parser
    '"__DATA__"': JSON.stringify(rows).replaceAll("<", "\\u003c"),
    __SUBTITLE__: escapeHtml(subtitle),
    // UTC ISO in the markup; the template's script converts it to the
    // viewer's local time on load
    __GENERATED_AT__: escapeHtml(meta.generatedAt),
    __USERS__: String(meta.usersScanned),
    __GRANTS__: String(meta.grantCount),
    __APPS__: String(rows.length),
    __RISKY__: String(meta.riskyCount),
  };
  let html = TEMPLATE;
  // replacer function so "$" sequences in app names are never special
  for (const [token, value] of Object.entries(tokens))
    html = html.replaceAll(token, () => value);
  return html;
}
