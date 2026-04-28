# Aonsoku BasicAuth Fork Maintenance

This public fork carries reverse-proxy BasicAuth support and a desktop MPV song
engine patch on top of `victoralvesf/aonsoku:main`.

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
- Desktop song playback is MPV-first. Web audio remains for web builds,
  radio, podcasts, and visible fallback when MPV cannot start or load a stream.
- MPV must receive proxy BasicAuth only from Electron main using the
  safeStorage-backed secret. Do not pass proxy credentials through renderer
  state, URL userinfo, command-line args, or logs.
- The `node-mpv` controller dependency must be bundled into Electron main.
  The MPV player binary itself is not bundled in v1; users install `mpv` or
  configure an MPV binary path in Audio settings.

## Current patch map

- Shared helpers: `src/utils/proxy-auth.ts`
- Login UI and save flow: `src/app/components/login/form.tsx`
- Store/types: `src/store/app.store.ts`, `src/types/serverConfig.ts`
- Main-process secret storage and header injection:
  `electron/main/core/proxy-auth.ts`
- MPV playback bridge: `electron/main/core/mpvPlayer.ts`,
  `src/app/components/player/mpv-audio.tsx`
- Audio engine selection: `src/utils/audio-engine.ts`,
  `src/app/components/settings/pages/audio/audio-engine.tsx`
- Renderer-to-main sync: `src/utils/proxy-auth-sync.ts`,
  `src/app/observers/proxy-auth-observer.tsx`, route loaders
- Release gates and smoke harness: `scripts/*basic-auth*`
- Fork identity: `package.json`, `electron-builder.yml`, `electron/main/index.ts`

## Upstream sync procedure

1. Fetch `upstream main` and compare it to
   `docs/upstream-sync-state.json:lastSyncedUpstreamSha`.
2. If unchanged, run the lightweight gates and stop.
3. If changed, create a new sync branch from `upstream/main`.
4. Reapply the BasicAuth and MPV patches using the invariants above.
5. Run the release gates. Do not publish if any gate is red.
6. If green, update `docs/upstream-sync-state.json`, bump the fork version to
   `<upstream-version>-ba.<run>`, merge to the private release branch, push, and
   publish private release artifacts.

## Release gates

Use `node scripts/run-basic-auth-release-gates.mjs --full` for release
candidates. It runs:

- BasicAuth and audio-engine helper tests.
- Web and Electron builds.
- Electron main runtime dependency check.
- Biome lint.
- Secret-redaction scan.
- Traefik/Navidrome BasicAuth smoke harness.
- Windows package build.
- Release artifact metadata normalization/check. `latest.yml` must point to the
  x64 installer at top level and include whitespace-free x64, arm64, and
  combined installer entries; blockmaps must be present as sibling assets.

Manual desktop release smoke must include MPV installed/configured, a protected
Navidrome server, and direct playback of a high-resolution FLAC without server
transcoding.

The smoke harness starts Navidrome behind Traefik BasicAuth and verifies that an
unauthenticated request gets `401` while an authenticated request reaches the
server.
