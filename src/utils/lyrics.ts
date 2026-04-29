export type SynchronizedLyricsArray = Array<[number, string]>

export const LYRIC_LINE_BREAK = '_BREAK_'

const timeTagExp = /\[(\d{1,}):(\d{2})(?:[.:](\d{1,3}))?]/g
const syncedTimeTagExp = /\[\d{1,}:\d{2}(?:[.:]\d{1,3})?]/
const enhancedTimeTagExp = /<\d{1,}:\d{2}(?:[.:]\d{1,3})?>/g
const offsetTagExp = /^\s*\[offset:([+-]?\d+)]\s*$/i
const alternateTimeExp = /^\[(\d+),(\d+)](.*)$/

const appendLyricLine = (existing: string, next: string) => {
  const cleanNext = next.trim()
  if (!cleanNext) return existing
  if (existing.split(LYRIC_LINE_BREAK).includes(cleanNext)) return existing
  if (!existing) return cleanNext
  return `${existing}${LYRIC_LINE_BREAK}${cleanNext}`
}

const parseTimeTag = (minute: string, second: string, milli?: string) => {
  const minutes = Number.parseInt(minute, 10)
  const seconds = Number.parseInt(second, 10)
  const milliseconds =
    milli == null ? 0 : Number.parseInt(milli.padEnd(3, '0').slice(0, 3), 10)

  return (minutes * 60 + seconds) * 1000 + milliseconds
}

const cleanLyricText = (text: string) =>
  text.replaceAll(enhancedTimeTagExp, '').trim()

const addSyncedLine = (
  lines: SynchronizedLyricsArray,
  lineIndexByTime: Map<number, number>,
  time: number,
  text: string,
) => {
  const cleanText = cleanLyricText(text)
  const existingIndex = lineIndexByTime.get(time)

  if (existingIndex == null) {
    lineIndexByTime.set(time, lines.length)
    lines.push([time, cleanText])
    return
  }

  lines[existingIndex][1] = appendLyricLine(lines[existingIndex][1], cleanText)
}

export const parseLyricsForDisplay = (
  lyrics: string,
): string | SynchronizedLyricsArray => {
  const formattedLyrics: SynchronizedLyricsArray = []
  const lineIndexByTime = new Map<number, number>()
  let offsetMs = 0

  for (const rawLine of lyrics.split(/\r?\n/)) {
    const offsetMatch = rawLine.match(offsetTagExp)
    if (offsetMatch) {
      offsetMs = Number.parseInt(offsetMatch[1], 10)
      continue
    }

    const timeMatches = [...rawLine.matchAll(timeTagExp)]
    if (timeMatches.length > 0) {
      const text = rawLine.replaceAll(timeTagExp, '')

      for (const match of timeMatches) {
        const [, minute, second, milli] = match
        addSyncedLine(
          formattedLyrics,
          lineIndexByTime,
          parseTimeTag(minute, second, milli) + offsetMs,
          text,
        )
      }
      continue
    }

    if (formattedLyrics.length > 0) {
      const cleanText = cleanLyricText(rawLine)
      if (cleanText) {
        const lastLine = formattedLyrics[formattedLyrics.length - 1]
        lastLine[1] = appendLyricLine(lastLine[1], cleanText)
      }
    }
  }

  if (formattedLyrics.length > 0) {
    return formattedLyrics.sort((a, b) => a[0] - b[0])
  }

  for (const rawLine of lyrics.split(/\r?\n/)) {
    const match = rawLine.match(alternateTimeExp)
    if (!match) continue

    const [, timeInMilliseconds, , text] = match
    const cleanText = text
      .replaceAll(/\(\d+,\d+\)/g, '')
      .replaceAll(/\s,/g, ',')
      .replaceAll(/\s\./g, '.')
      .trim()

    addSyncedLine(
      formattedLyrics,
      lineIndexByTime,
      Number.parseInt(timeInMilliseconds, 10),
      cleanText,
    )
  }

  if (formattedLyrics.length > 0) {
    return formattedLyrics.sort((a, b) => a[0] - b[0])
  }

  return lyrics.trim().replaceAll('\r\n', '\n')
}

export const mergeSyncedLyricTranslations = (
  mainLyrics: SynchronizedLyricsArray,
  translationTracks: SynchronizedLyricsArray[],
): SynchronizedLyricsArray => {
  if (translationTracks.length === 0) return mainLyrics

  const translationMaps = translationTracks.map((track) => new Map(track))

  return mainLyrics.map(([time, text], index) => {
    let mergedText = text

    for (let trackIndex = 0; trackIndex < translationTracks.length; trackIndex += 1) {
      const exactMatch = translationMaps[trackIndex].get(time)
      const fallbackMatch = translationTracks[trackIndex][index]?.[1]
      mergedText = appendLyricLine(mergedText, exactMatch ?? fallbackMatch ?? '')
    }

    return [time, mergedText]
  })
}

export const mergeDuplicateSyncedLyricLines = (
  lyrics: SynchronizedLyricsArray,
): SynchronizedLyricsArray => {
  const mergedLyrics: SynchronizedLyricsArray = []
  const lineIndexByTime = new Map<number, number>()

  for (const [time, text] of lyrics) {
    addSyncedLine(mergedLyrics, lineIndexByTime, time, text)
  }

  return mergedLyrics.sort((a, b) => a[0] - b[0])
}

const formatTimestamp = (timeMs: number) => {
  const safeTimeMs = Math.max(0, timeMs)
  const minutes = Math.floor(safeTimeMs / 60000)
  const seconds = Math.floor((safeTimeMs % 60000) / 1000)
  const milliseconds = Math.floor(safeTimeMs % 1000)

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export const formatSyncedLyricsForLrc = (lyrics: SynchronizedLyricsArray) =>
  lyrics
    .map(([time, text]) => {
      const timestamp = formatTimestamp(time)
      return text ? `[${timestamp}]${text}` : `[${timestamp}]`
    })
    .join('\n')

export const normalizeLyricsForDisplay = (lyrics: string) => {
  const parsedLyrics = parseLyricsForDisplay(lyrics)
  if (Array.isArray(parsedLyrics)) {
    return formatSyncedLyricsForLrc(parsedLyrics)
  }
  return parsedLyrics
}

export const isSyncedLyricsValue = (lyrics: string) =>
  syncedTimeTagExp.test(lyrics.trim())
