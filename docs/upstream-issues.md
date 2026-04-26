# Upstream Issue Notes

This public fork intentionally focuses on reverse-proxy BasicAuth first.

## Covered privately

- victoralvesf/aonsoku#252 - Basic auth support, covered in this fork.

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
