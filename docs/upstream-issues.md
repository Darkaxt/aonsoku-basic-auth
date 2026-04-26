# Upstream Issue Notes

This public fork intentionally focuses on reverse-proxy BasicAuth first.

## Covered privately

- victoralvesf/aonsoku#252 - Basic auth support, covered in this fork.
- victoralvesf/aonsoku#389 - ALAC `.m4a` playback via server-side `opus`
  transcoding and metadata duration fallback, carried from upstream
  `development` for `0.14.0-ba.2`.

## Reviewed but not claimed fixed

- victoralvesf/aonsoku#366 - Last seconds of songs being cut off. The current
  player advances on the native audio `ended` event, so this does not have an
  obvious low-risk app-side one-line fix without reproducing the stream/media
  failure. The ALAC/duration fallback above may help related transcoded-stream
  cases, but it should not be presented as a verified fix for this issue.

## Good follow-up candidates

- victoralvesf/aonsoku#400 - Add an option to disable home carousel autoplay.
  This looks low-risk because autoplay is localized to the home header carousel.
- victoralvesf/aonsoku#359 - Add full song-title tooltips where titles truncate.
  This is small and user-facing, but should be applied consistently across table,
  player, and marquee contexts.
- victoralvesf/aonsoku#228 - Rename user-facing "Radios" wording to "Radio".
  This is simple in English, but broader locale changes should be handled
  deliberately.

Defer these until the BasicAuth fork is built, smoke-tested, and released.
