#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs, styleText } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { createDirectory, scanDirectory } from "./connectors/google.ts";
import { renderHtml } from "./html.ts";
import { log, setLogLevel } from "./log.ts";
import { buildReport, type ReportRow, toCsv } from "./report.ts";

type OptionSpec = {
  type: "string" | "boolean";
  desc: string;
  required?: boolean;
  default?: string | boolean;
  placeholder?: string;
};

type Values = Record<string, string | boolean | undefined>;

const GLOBAL_OPTIONS: Record<string, OptionSpec> = {
  verbose: { type: "boolean", desc: "show debug output" },
  quiet: { type: "boolean", desc: "only show errors" },
  help: { type: "boolean", desc: "show help" },
};

const COMMANDS: Record<
  string,
  {
    desc: string;
    options: Record<string, OptionSpec>;
    run: (v: Values) => Promise<void> | void;
  }
> = {
  scan: {
    desc: "Scan your IdP for third-party OAuth app grants and report them",
    options: {
      connector: {
        type: "string",
        desc: "identity provider to scan",
        default: "google",
        placeholder: "<name>",
      },
      key: {
        type: "string",
        desc: "service account JSON key file",
        required: true,
        placeholder: "<sa.json>",
      },
      impersonate: {
        type: "string",
        desc: "admin email to impersonate",
        required: true,
        placeholder: "<email>",
      },
      domain: {
        type: "string",
        desc: "limit scan to one domain",
        placeholder: "<domain>",
      },
      ai: { type: "boolean", desc: "AI apps only" },
      risky: {
        type: "boolean",
        desc: "unverified apps holding high-risk scopes",
      },
      user: {
        type: "string",
        desc: "filter to one user",
        placeholder: "<email>",
      },
      json: { type: "boolean", desc: "print JSON to stdout" },
      csv: {
        type: "boolean",
        desc: "write CSV to ./data/reports/ instead of printing",
      },
      html: {
        type: "boolean",
        desc: "write a self-contained HTML report to ./data/reports/",
      },
      "fail-on-risky": {
        type: "boolean",
        desc: "exit 2 if any unverified high-risk apps exist",
      },
    },
    run: scanCmd,
  },
};

function optionLine(name: string, spec: OptionSpec): string {
  const flag = `--${name}${spec.type === "string" ? ` ${spec.placeholder ?? "<value>"}` : ""}`;
  const notes = [
    spec.required ? "required" : "",
    spec.default !== undefined ? `default: ${spec.default}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `  ${flag.padEnd(26)} ${spec.desc}${notes ? ` (${notes})` : ""}`;
}

function help(command?: string): string {
  const cmd = command ? COMMANDS[command] : undefined;
  if (command && cmd) {
    return [
      `Usage: assetloom-app-scanner ${command} [options]`,
      "",
      cmd.desc,
      "",
      "Options:",
      ...Object.entries(cmd.options).map(([n, s]) => optionLine(n, s)),
      "",
      "Global options:",
      ...Object.entries(GLOBAL_OPTIONS).map(([n, s]) => optionLine(n, s)),
    ].join("\n");
  }
  return [
    "assetloom-app-scanner — scan your IdP for third-party OAuth app grants",
    "",
    "Usage: assetloom-app-scanner <command> [options]",
    "",
    "Commands:",
    ...Object.entries(COMMANDS).map(([n, c]) => `  ${n.padEnd(10)} ${c.desc}`),
    "",
    "Run 'assetloom-app-scanner <command> --help' for command options.",
    "Run 'assetloom-app-scanner --version' (or -v) to show the version.",
  ].join("\n");
}

function fail(msg: string, command?: string): never {
  log.error(msg);
  process.stderr.write(`\n${help(command)}\n`);
  process.exit(1);
}

function progressRenderer(): (
  done: number,
  total: number,
  email: string,
) => void {
  if (process.stderr.isTTY) {
    const WIDTH = 24;
    return (done, total, email) => {
      const filled = Math.round((done / total) * WIDTH);
      const bar =
        styleText("green", "█".repeat(filled)) + "░".repeat(WIDTH - filled);
      process.stderr.write(
        `\r${bar} ${done}/${total} (${email})`.padEnd(90).slice(0, 90),
      );
      if (done === total) process.stderr.write("\n");
    };
  }
  return (done, total) => {
    if (done % 25 === 0 || done === total)
      log.info(`Scanning grants ${done}/${total}`);
  };
}

function printTable(rows: ReportRow[]): void {
  const cols = process.stdout.columns ?? 120;
  const catW = Math.max(8, ...rows.map((r) => r.category.length));
  // fixed columns: risk 6, source 8, users 5, four 2-space gaps
  const appW = Math.max(20, Math.min(64, cols - catW - 28));
  const clip = (s: string) =>
    s.length > appW ? `${s.slice(0, appW - 1)}…` : s;
  const tty = process.stdout.isTTY;
  const riskColor = (r: string) => {
    if (!tty) return r.padEnd(6);
    const color = r === "high" ? "red" : r === "medium" ? "yellow" : "dim";
    return styleText(color, r.padEnd(6));
  };
  const header = `${"APP".padEnd(appW)}  ${"CATEGORY".padEnd(catW)}  ${"RISK".padEnd(6)}  ${"SOURCE".padEnd(8)}  USERS`;
  console.log(tty ? styleText("bold", header) : header);
  for (const r of rows) {
    console.log(
      `${clip(r.display_name).padEnd(appW)}  ${r.category.padEnd(catW)}  ` +
        `${riskColor(r.risk_level)}  ${r.classified_by.padEnd(8)}  ${String(r.user_count).padStart(5)}`,
    );
  }
}

async function scanCmd(v: Values): Promise<void> {
  const outputs = ["json", "csv", "html"].filter((o) => v[o]);
  if (outputs.length > 1)
    fail(`--${outputs.join(" and --")} are mutually exclusive`, "scan");
  const connector = v.connector as string;
  if (connector !== "google")
    fail(`unknown connector: ${connector} (available: google)`, "scan");

  const dir = createDirectory(v.key as string, v.impersonate as string);
  log.info(`Fetching users from Google Workspace as ${v.impersonate}...`);
  const result = await scanDirectory(dir, {
    domain: v.domain as string | undefined,
    log: (msg) => log.warn(msg),
    progress: v.quiet ? undefined : progressRenderer(),
  });

  const rows = buildReport(result.grants, {
    ai: v.ai as boolean,
    risky: v.risky as boolean,
    user: v.user as string | undefined,
  });
  const failures = result.errors ? `, ${result.errors} user(s) failed` : "";
  log.info(
    `Scanned ${result.users.length} users: ${result.grants.length} grants${failures}, ${rows.length} app(s) reported`,
  );
  const riskyCount = buildReport(result.grants, { risky: true }).length;
  const filters = [
    v.ai && "ai",
    v.risky && "risky",
    v.user && `user:${v.user}`,
  ].filter(Boolean) as string[];

  const writeReport = (ext: string, content: string): void => {
    const name = ["scan", v.ai && "ai", v.risky && "risky", v.user && "user"]
      .filter(Boolean)
      .join("-");
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    const path = `./data/reports/${name}-${stamp}.${ext}`;
    mkdirSync("./data/reports", { recursive: true });
    writeFileSync(path, content);
    console.log(path);
  };

  if (v.csv) {
    writeReport("csv", toCsv(rows));
  } else if (v.html) {
    writeReport(
      "html",
      renderHtml(rows, {
        connector,
        generatedAt: new Date().toISOString(),
        usersScanned: result.users.length,
        grantCount: result.grants.length,
        errors: result.errors,
        riskyCount,
        filters,
      }),
    );
  } else if (v.json) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (rows.length === 0) {
    console.log("No third-party app grants found.");
  } else {
    printTable(rows);
  }

  if (v["fail-on-risky"] && riskyCount) process.exit(2);
}

const [command, ...rest] = process.argv.slice(2);

if (!command) fail("missing command");
if (command === "help" || command === "--help" || command === "-h") {
  console.log(help());
  process.exit(0);
}
if (command === "--version" || command === "-v") {
  console.log(pkg.version);
  process.exit(0);
}
const cmd = COMMANDS[command];
if (!cmd) fail(`unknown command: ${command}`);

const spec = { ...GLOBAL_OPTIONS, ...cmd.options };
const parseOptions = Object.fromEntries(
  Object.entries(spec).map(([n, s]) => [
    n,
    {
      type: s.type,
      ...(s.default !== undefined ? { default: s.default } : {}),
    },
  ]),
) as import("node:util").ParseArgsConfig["options"];

let values: Values;
try {
  ({ values } = parseArgs({
    args: rest,
    options: parseOptions,
    allowPositionals: false,
  }));
} catch (err) {
  fail((err as Error).message, command);
}

if (values.help) {
  console.log(help(command));
  process.exit(0);
}
if (values.verbose) setLogLevel("debug");
if (values.quiet) setLogLevel("error");

for (const [name, s] of Object.entries(spec)) {
  if (s.required && values[name] === undefined)
    fail(`${command} requires --${name}`, command);
}

// async IIFE instead of top-level await so the bundle stays valid CJS
// (Node SEA accepts only CommonJS entry scripts)
(async () => {
  try {
    await cmd.run(values);
  } catch (err) {
    log.debug((err as Error).stack ?? "");
    log.error((err as Error).message ?? String(err));
    process.exit(1);
  }
})();
