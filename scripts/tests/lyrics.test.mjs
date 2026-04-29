import { existsSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'

const lyrics = await import('../../src/utils/lyrics.ts')

test('parseLyricsForDisplay merges duplicate timestamps as translated lyric lines', () => {
  const result = lyrics.parseLyricsForDisplay(`[00:10.358]Original line
[00:10.358]Translated line
[00:12.918]Second original
[00:12.918]Second translation`)

  assert.deepEqual(result, [
    [10358, 'Original line_BREAK_Translated line'],
    [12918, 'Second original_BREAK_Second translation'],
  ])
})

test('parseLyricsForDisplay collapses duplicate timestamps when the text is identical', () => {
  const result = lyrics.parseLyricsForDisplay(`[00:10.358]Same line
[00:10.358]Same line`)

  assert.deepEqual(result, [[10358, 'Same line']])
})

test('parseLyricsForDisplay treats untimestamped continuation lines as translated lyric lines', () => {
  const result = lyrics.parseLyricsForDisplay(`[00:01.000]Original line
Translated line
[00:02.500]Second original
Second translation`)

  assert.deepEqual(result, [
    [1000, 'Original line_BREAK_Translated line'],
    [2500, 'Second original_BREAK_Second translation'],
  ])
})

test('normalizeLyricsForDisplay preserves duplicate timestamp translations for react-lrc', () => {
  const result = lyrics.normalizeLyricsForDisplay(`[00:01.00]Original line
[00:01.00]Translated line
[00:02.00]`)

  assert.equal(
    result,
    '[00:01.000]Original line_BREAK_Translated line\n[00:02.000]',
  )
})

test('mergeSyncedLyricTranslations appends OpenSubsonic translation tracks by timestamp', () => {
  const result = lyrics.mergeSyncedLyricTranslations(
    [
      [2747, 'Original one'],
      [6214, 'Original two'],
    ],
    [
      [
        [2747, 'Translated one'],
        [6214, 'Translated two'],
      ],
    ],
  )

  assert.deepEqual(result, [
    [2747, 'Original one_BREAK_Translated one'],
    [6214, 'Original two_BREAK_Translated two'],
  ])
})

test('mergeSyncedLyricTranslations falls back to line index when timestamps differ', () => {
  const result = lyrics.mergeSyncedLyricTranslations(
    [
      [1000, 'Original one'],
      [2000, 'Original two'],
    ],
    [
      [
        [1010, 'Translated one'],
        [2010, 'Translated two'],
      ],
    ],
  )

  assert.deepEqual(result, [
    [1000, 'Original one_BREAK_Translated one'],
    [2000, 'Original two_BREAK_Translated two'],
  ])
})

test('local translated LRC fixture parses duplicate timestamps into dual lines', () => {
  const fixturePath = process.env.AONSOKU_LYRICS_FIXTURE_PATH

  if (!fixturePath || !existsSync(fixturePath)) {
    assert.ok(true)
    return
  }

  const text = readFileSync(fixturePath, 'utf8')
  const result = lyrics.parseLyricsForDisplay(text)

  assert.ok(Array.isArray(result))
  assert.equal(result.length, 37)

  const translatedLineCount = result.filter(([, line]) =>
    line.includes(lyrics.LYRIC_LINE_BREAK),
  ).length

  assert.equal(translatedLineCount, 34)
})
