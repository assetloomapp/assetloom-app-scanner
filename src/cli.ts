#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs, styleText } from "node:util";
import pkg from "../package.json" with { type: "json" };
import {
  createEntraClient,
  entraClient,
  scanEntra,
} from "./connectors/entra.ts";
import { createDirectory, scanDirectory } from "./connectors/google.ts";
import {
  adminTokenUrl,
  createOktaClient,
  normalizeOrgUrl,
  oktaClient,
  scanOkta,
} from "./connectors/okta.ts";
import type { ScanResult } from "./connectors/types.ts";
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

const KEY_DIR = "~/.assetloom-scanner";

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

const GLOBAL_OPTIONS: Record<string, OptionSpec> = {
  verbose: { type: "boolean", desc: "show debug output" },
  quiet: { type: "boolean", desc: "only show errors" },
  help: { type: "boolean", desc: "show help" },
};

const OUTPUT_OPTIONS: Record<string, OptionSpec> = {
  ai: { type: "boolean", desc: "AI apps only" },
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
};

const COMMANDS: Record<
  string,
  {
    desc: string;
    options: Record<string, OptionSpec>;
    run: (v: Values) => Promise<void> | void;
  }
> = {
  google: {
    desc: "Scan Google Workspace for third-party OAuth app grants",
    options: {
      key: {
        type: "string",
        desc: "service account JSON key file",
        default: `${KEY_DIR}/google.json`,
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
      risky: {
        type: "boolean",
        desc: "unverified apps holding high-risk scopes",
      },
      ...OUTPUT_OPTIONS,
      "fail-on-risky": {
        type: "boolean",
        desc: "exit 2 if any unverified high-risk apps exist",
      },
    },
    run: googleCmd,
  },
  okta: {
    desc: "Scan Okta for SSO app assignments",
    options: {
      key: {
        type: "string",
        desc: "credentials JSON file, created by 'config okta'",
        default: `${KEY_DIR}/okta.json`,
        placeholder: "<okta.json>",
      },
      ...OUTPUT_OPTIONS,
    },
    run: oktaCmd,
  },
  entra: {
    desc: "Scan Microsoft Entra ID for delegated OAuth app grants",
    options: {
      key: {
        type: "string",
        desc: "credentials JSON file, created by 'config entra'",
        default: `${KEY_DIR}/entra.json`,
        placeholder: "<entra.json>",
      },
      risky: {
        type: "boolean",
        desc: "unverified apps holding high-risk scopes",
      },
      ...OUTPUT_OPTIONS,
      "fail-on-risky": {
        type: "boolean",
        desc: "exit 2 if any unverified high-risk apps exist",
      },
    },
    run: entraCmd,
  },
  "config okta": {
    desc: "Interactively create the okta credentials file for --key",
    options: {},
    run: configOktaCmd,
  },
  "config google": {
    desc: "Validate a downloaded service account key and install it for --key",
    options: {},
    run: configGoogleCmd,
  },
  "config entra": {
    desc: "Interactively create the entra credentials file for --key",
    options: {},
    run: configEntraCmd,
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

// connectors report progress at "info" and per-item failures at "warn"
const scanLog = (msg: string, level?: "info" | "warn"): void =>
  log[level ?? "warn"](msg);

function keyFile(v: Values, command: string, hint: string): string {
  const key = expandHome(v.key as string);
  if (!existsSync(key)) fail(`key file not found: ${key} — ${hint}`, command);
  return key;
}

async function googleCmd(v: Values): Promise<void> {
  checkOutputFlags(v, "google");
  const key = keyFile(
    v,
    "google",
    "save your service account key there or pass --key",
  );
  const dir = createDirectory(key, v.impersonate as string);
  log.info(`Fetching users from Google Workspace as ${v.impersonate}...`);
  const result = await scanDirectory(dir, {
    domain: v.domain as string | undefined,
    log: scanLog,
    progress: v.quiet ? undefined : progressRenderer(),
  });
  report(v, result, "google");
}

async function oktaCmd(v: Values): Promise<void> {
  checkOutputFlags(v, "okta");
  const client = createOktaClient(
    keyFile(v, "okta", "run 'assetloom-app-scanner config okta' or pass --key"),
  );
  log.info("Fetching apps from Okta...");
  const result = await scanOkta(client, {
    log: scanLog,
    progress: v.quiet ? undefined : progressRenderer(),
  });
  report(v, result, "okta");
}

async function entraCmd(v: Values): Promise<void> {
  checkOutputFlags(v, "entra");
  const client = createEntraClient(
    keyFile(
      v,
      "entra",
      "run 'assetloom-app-scanner config entra' or pass --key",
    ),
  );
  log.info("Fetching OAuth grants from Microsoft Entra ID...");
  const result = await scanEntra(client, {
    log: scanLog,
    progress: v.quiet ? undefined : progressRenderer(),
  });
  report(v, result, "entra");
}

/** Read the token on a TTY without echoing it (tokens stay off the screen). */
function askSecretTty(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stderr.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off("data", onData);
        process.stderr.write("\n");
        resolve(buf.trim());
      } else if (ch === "\u0003") {
        process.stderr.write("\n");
        process.exit(130);
      } else if (ch === "\u007f") {
        buf = buf.slice(0, -1);
      } else {
        buf += ch;
      }
    };
    process.stdin.on("data", onData);
  });
}

/**
 * Line-based prompt on stderr (stdout stays clean for command results).
 * Lines are buffered from the start: with piped stdin, answers can all
 * arrive in one chunk before the second question is even asked.
 */
function lineReader() {
  const rl = createInterface({ input: process.stdin });
  const lines: string[] = [];
  const waiters: Array<(s: string) => void> = [];
  rl.on("line", (l) => {
    const w = waiters.shift();
    if (w) w(l);
    else lines.push(l);
  });
  rl.on("close", () => {
    for (const w of waiters.splice(0)) w("");
  });
  return {
    question(prompt: string): Promise<string> {
      process.stderr.write(prompt);
      const l = lines.shift();
      if (l !== undefined) return Promise.resolve(l);
      return new Promise((r) => waiters.push(r));
    },
    close: () => rl.close(),
  };
}

async function configOktaCmd(_v: Values): Promise<void> {
  let rl = lineReader();
  try {
    const orgInput = await rl.question(
      "Okta org URL or subdomain (e.g. acme, https://acme.okta.com): ",
    );
    const org = normalizeOrgUrl(orgInput.trim());
    log.info(`Org URL: ${org}`);
    log.info("Create an API token (read-only admin is enough) at:");
    log.info(`  ${adminTokenUrl(org)}`);
    let token: string;
    if (process.stdin.isTTY) {
      // raw-mode read needs stdin to itself; reopen a reader afterwards
      // (interactive input has no buffered lines to lose)
      rl.close();
      token = await askSecretTty("Paste the API token: ");
      rl = lineReader();
    } else {
      token = (await rl.question("Paste the API token: ")).trim();
    }
    if (!token) fail("no token provided", "config okta");
    log.info("Verifying the token...");
    try {
      await oktaClient(org, token).get("/api/v1/apps?limit=1");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401)
        throw new Error(
          `${org} rejected the token (401). Check that it was pasted in full and has not expired or been revoked, and that the org URL is yours.`,
        );
      if (status === 403)
        throw new Error(
          `${org} accepted the token but refused to list apps (403). The token inherits its creator's permissions — create it as an admin with read access to applications.`,
        );
      throw err;
    }
    log.info("Token works.");
    let out = expandHome(
      (
        await rl.question(`Save credentials to [${KEY_DIR}/okta.json]: `)
      ).trim() || `${KEY_DIR}/okta.json`,
    );
    if (existsSync(out) && statSync(out).isDirectory())
      out = join(out, "okta.json");
    await confirmOverwrite(rl, out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify({ org, token }, null, 2)}\n`, {
      mode: 0o600,
    });
    console.log(out);
    log.info(`Scan with: assetloom-app-scanner okta --key ${out}`);
  } finally {
    rl.close();
  }
}

async function configEntraCmd(_v: Values): Promise<void> {
  let rl = lineReader();
  try {
    log.info(
      "Register an app with the Microsoft Graph Directory.Read.All application permission by following:",
    );
    log.info(
      "  https://assetloomapp.github.io/assetloom-app-scanner/setup/entra/",
    );
    const tenant = (
      await rl.question(
        "Tenant ID (or primary domain, e.g. contoso.onmicrosoft.com): ",
      )
    ).trim();
    if (!tenant) fail("no tenant provided", "config entra");
    const clientId = (await rl.question("Application (client) ID: ")).trim();
    if (!clientId) fail("no client ID provided", "config entra");
    let clientSecret: string;
    if (process.stdin.isTTY) {
      // raw-mode read needs stdin to itself; reopen a reader afterwards
      rl.close();
      clientSecret = await askSecretTty("Paste the client secret value: ");
      rl = lineReader();
    } else {
      clientSecret = (
        await rl.question("Paste the client secret value: ")
      ).trim();
    }
    if (!clientSecret) fail("no client secret provided", "config entra");
    const key = { tenant, clientId, clientSecret };
    log.info("Verifying the credentials...");
    try {
      await entraClient(key).get("/v1.0/servicePrincipals?$top=1");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 400 || status === 401)
        throw new Error(
          `Microsoft rejected the credentials (${status}). Check the tenant ID and client ID, and that the secret VALUE (not its ID) was pasted in full and has not expired.`,
        );
      if (status === 403)
        throw new Error(
          "The credentials work but Microsoft Graph refused to list service principals (403). Grant the app the Directory.Read.All application permission and click 'Grant admin consent'.",
        );
      throw err;
    }
    log.info("Credentials work.");
    let out = expandHome(
      (
        await rl.question(`Save credentials to [${KEY_DIR}/entra.json]: `)
      ).trim() || `${KEY_DIR}/entra.json`,
    );
    if (existsSync(out) && statSync(out).isDirectory())
      out = join(out, "entra.json");
    await confirmOverwrite(rl, out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(key, null, 2)}\n`, { mode: 0o600 });
    console.log(out);
    log.info(`Scan with: assetloom-app-scanner entra --key ${out}`);
  } finally {
    rl.close();
  }
}

/** Exits unless the user confirms overwriting an existing file (default no). */
async function confirmOverwrite(
  rl: ReturnType<typeof lineReader>,
  out: string,
): Promise<void> {
  if (!existsSync(out)) return;
  const yn = (
    await rl.question(`${out} already exists. Overwrite? (y/N): `)
  ).trim();
  if (!/^y(es)?$/i.test(yn)) {
    log.error(`not overwriting ${out}`);
    process.exit(1);
  }
}

async function configGoogleCmd(_v: Values): Promise<void> {
  const rl = lineReader();
  try {
    log.info(
      "Create a service account and download its JSON key by following:",
    );
    log.info(
      "  https://assetloomapp.github.io/assetloom-app-scanner/setup/google-workspace/",
    );
    const src = expandHome(
      (
        await rl.question("Path to the downloaded service account JSON key: ")
      ).trim(),
    );
    if (!src || !existsSync(src)) fail(`no file at ${src}`, "config google");
    let key: { type?: string; client_email?: string; private_key?: string };
    try {
      key = JSON.parse(readFileSync(src, "utf8"));
    } catch {
      fail(`${src} is not valid JSON`, "config google");
    }
    if (key.type !== "service_account" || !key.client_email || !key.private_key)
      fail(
        `${src} is not a service account key — expected type "service_account" with client_email and private_key. Make sure you downloaded the key from the service account's Keys tab, not an OAuth client.`,
        "config google",
      );
    log.info(`Key looks valid (service account: ${key.client_email}).`);
    const dest = expandHome(`${KEY_DIR}/google.json`);
    const yn = (
      await rl.question(
        `Copy it to ${KEY_DIR}/google.json so scans can omit --key? (Y/n): `,
      )
    ).trim();
    if (/^n(o)?$/i.test(yn)) {
      log.info(
        `Scan with: assetloom-app-scanner google --key ${src} --impersonate admin@yourdomain.com`,
      );
      return;
    }
    await confirmOverwrite(rl, dest);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(src), { mode: 0o600 });
    console.log(dest);
    log.info(
      "Scan with: assetloom-app-scanner google --impersonate admin@yourdomain.com",
    );
  } finally {
    rl.close();
  }
}

function checkOutputFlags(v: Values, command: string): void {
  const outputs = ["json", "csv", "html"].filter((o) => v[o]);
  if (outputs.length > 1)
    fail(`--${outputs.join(" and --")} are mutually exclusive`, command);
}

function report(v: Values, result: ScanResult, connector: string): void {
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

let [command, ...rest] = process.argv.slice(2);
// two-word commands like "config okta"
if (!COMMANDS[command] && COMMANDS[`${command} ${rest[0]}`]) {
  command = `${command} ${rest[0]}`;
  rest = rest.slice(1);
}

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
