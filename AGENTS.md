## Agent guideline for scripting & commands

Do not use inline script in agent commands. If you need to run a script, create a script file in `./tmp/` dir and call it from there. This prevents script permission issues, and it is easier to manage, reuse, debug scripts.

Do not use `cd` if not necessary. Never use `git -C` unless absolutely required, because you will always be in this working dir/repo. If you need to run a command in a dir, it is better to just invoke at this repo dir with a proper path handling. This prevents issues with relative paths and makes it easier to debug commands.

## Project rules

### Portability

* Write portable Node/TypeScript (Node 26+). Import only `node:` builtins — never `bun:*` or `deno.*` APIs.
* Dependencies must be pure JavaScript. No native addons.
* Single-file executables are built with `bun build --compile` in the release workflow only. Nothing in `src/` may depend on the compiler or runtime being Bun.

### Stdlib first

* CLI parsing: `node:util.parseArgs`. No commander/yargs.
* Tests: `node:test` with fixture JSON. No mocking frameworks.

### Dependencies

* Allowed runtime deps: `googleapis`, and later the official Entra/Okta SDKs. Anything else requires user approval.
* No AI SDK dependency. LLM enrichment is post-MVP; when built, it calls the Anthropic API with plain `fetch`.

### Structure

* Single package. Everything except `cli.ts` must stay importable as a library — the future web app wraps the same core.
* CLI commands are declared in the command table in `src/cli.ts` (options with type/desc/required/default); `--help` is generated from it. Never hand-write usage text.
* Log through `src/log.ts` (`log.debug/info/warn/error`, gated by `--verbose`/`--quiet`), never bare `console.error`. stdout carries only command results (table/JSON) so pipelines stay clean.
* Generic helpers (`withRetry`, `mapLimit`) live in `src/utils.ts` — reuse them in new connectors.
* Scan-and-forget: results are never persisted — they live in memory for the duration of the run. The only local output is CSV exports under `./data/reports/` (gitignored). Never write scan output elsewhere.
* Package manager is pnpm. Run tests with `pnpm test` (plain `node --test`; do not pass a directory argument — it is treated as a glob).
* The catalog (`src/catalog/apps.ts`) ships with the tool for public use. `clients` entries require the ID to be vendor-published, with a comment citing the source (vendor docs or source code) — that citation is the actual trust anchor. Never add org-specific or merely tenant-observed client IDs — users maintain those in their own copy.
* No `Connector` interface while there is one connector. The normalized `Grant` type is the contract; extract the interface when the second connector (Entra) is written.
* LLM classification is post-MVP. Do not build it until asked. When built: optional, cached, runs only via an explicit `enrich` command, never re-classifies an already-classified app.
