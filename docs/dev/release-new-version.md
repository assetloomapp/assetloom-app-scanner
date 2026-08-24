# Releasing a new version

Releases are tag-driven: pushing a `v*` tag makes `.github/workflows/release.yml` build the per-platform binaries and publish a GitHub Release. The version shown by `assetloom-app-scanner -v` comes from `package.json`, so the bump and the tag must move together.

## Steps

1. **Verify main is green** — everything a release ships must pass locally first:

   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   node scripts/verify-catalog.ts   # if catalog entries changed since the last release
   ```

2. **Bump the version** in `package.json` (semver: patch for fixes, minor for features, major for breaking CLI changes):

   ```bash
   npm version minor --no-git-tag-version
   ```

3. **Commit and push** the bump to `main`:

   ```bash
   git add package.json
   git commit -m "release: v0.2.0"
   git push
   ```

4. **Tag and push the tag** — reads the version from package.json, so it always matches:

   ```bash
   pnpm release
   ```

5. **Watch the workflow** (Actions → Release). It runs `pnpm gen`, cross-compiles with `bun build --compile` for linux-x64/arm64, darwin-x64/arm64, and windows-x64, packages them as `.tar.gz`/`.zip` (archives preserve the executable bit), and creates the GitHub Release with auto-generated notes.

6. **Check the release page** — five archives attached, notes sensible. Edit the notes by hand if the auto-generated ones need context.

7. **npm**: we do not publish to npm yet. When we start, add `npm publish` here (the package is already set up: ships TypeScript sources via `files: ["src"]`, requires Node 26+ at runtime, no build step) and restore the `npx` mentions in the README and `docs/public/installation.md`.

## If a release goes wrong

- **Workflow failed after tagging**: fix the problem on `main`, delete the tag locally and remotely (`git tag -d v0.2.0 && git push origin :refs/tags/v0.2.0`), and re-tag. Never reuse a tag that produced a published release — bump to the next patch instead.
- **Bad binaries already published**: do not delete the release; publish a fixed patch release and mark the bad one as such in its notes.

## Notes

- The docs site deploys separately (`docs.yml`, on every push to `main`) — no release needed for documentation changes.
- The version in generated reports and `-v` is baked into the binaries at compile time from `package.json`; a tag that does not match the committed version ships a binary that reports the wrong version. Step 3 before step 4, always.
