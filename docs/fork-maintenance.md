# Aonsoku BasicAuth Fork Maintenance

This public fork carries a narrow reverse-proxy BasicAuth patch on top of
`victoralvesf/aonsoku:main`.

## Patch invariants

- Persist only `proxyAuth.enabled`, `proxyAuth.type`, and `proxyAuth.username`
  in the Zustand app store.
- Store proxy BasicAuth passwords only in Electron `safeStorage` using
  `proxy-basic-auth:server`.
- Strip URL userinfo credentials from server URLs before saving; migrate those
  values into the proxy BasicAuth fields when present.
- Sync the configured server origin to the Electron main process and inject
  `Authorization: Basic ...` only for that origin.
- Do not log, persist, or commit proxy passwords or generated Basic headers.
- Do not overwrite an existing `Authorization` request header. Aonsoku's
  Subsonic credentials stay in query params, but this keeps future app-level
  header auth safe.
- Treat desktop Electron as the supported v1 target. Web/Docker should continue
  to work without proxy BasicAuth persistence.

## Current patch map

- Shared helpers: `src/utils/proxy-auth.ts`
- Login UI and save flow: `src/app/components/login/form.tsx`
- Store/types: `src/store/app.store.ts`, `src/types/serverConfig.ts`
- Main-process secret storage and header injection:
  `electron/main/core/proxy-auth.ts`
- Renderer-to-main sync: `src/utils/proxy-auth-sync.ts`,
  `src/app/observers/proxy-auth-observer.tsx`, route loaders
- Release gates and smoke harness: `scripts/*basic-auth*`
- Fork identity: `package.json`, `electron-builder.yml`, `electron/main/index.ts`

## Upstream sync procedure

1. Fetch `upstream main` and compare it to
   `docs/upstream-sync-state.json:lastSyncedUpstreamSha`.
2. If unchanged, run the lightweight gates and stop.
3. If changed, create a new sync branch from `upstream/main`.
4. Reapply the BasicAuth patch using the invariants above.
5. Run the release gates. Do not publish if any gate is red.
6. If green, update `docs/upstream-sync-state.json`, bump the fork version to
   `<upstream-version>-ba.<run>`, merge to the private release branch, push, and
   publish private release artifacts.

## Release gates

Use `node scripts/run-basic-auth-release-gates.mjs --full` for release
candidates. It runs:

- BasicAuth helper tests.
- Web and Electron builds.
- Biome lint.
- Secret-redaction scan.
- Traefik/Navidrome BasicAuth smoke harness.
- Windows package build.

The smoke harness starts Navidrome behind Traefik BasicAuth and verifies that an
unauthenticated request gets `401` while an authenticated request reaches the
server.
