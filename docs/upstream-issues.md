# Upstream Issue Notes

This public fork intentionally focuses on reverse-proxy BasicAuth first, with a
desktop MPV playback exception because Chromium/Web audio failures can make the
client unusable for lossless libraries.

## Covered privately

- victoralvesf/aonsoku#252 - Basic auth support, covered in this fork.
- victoralvesf/aonsoku#389 - ALAC `.m4a` playback via server-side `opus`
  transcoding and metadata duration fallback, carried from upstream
  `development` for `0.14.0-ba.2`.
- High-resolution/lossless song playback stability - this fork defaults
  desktop song playback to MPV, while keeping Web audio for web builds, radio,
  podcasts, and fallback. `0.14.0-ba.4` fixes the packaged Electron runtime
  dependency for the MPV controller.

## Reviewed but not claimed fixed

- victoralvesf/aonsoku#366 - Last seconds of songs being cut off. The current
  upstream player advances on the native audio `ended` event. The MPV desktop
  engine should reduce this class of Web-audio failure, but it should not be
  presented as a verified #366 fix until reproduced and smoke-tested against
  the affected media.

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
