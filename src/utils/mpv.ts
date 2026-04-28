import { redactProxyAuthFromText } from './proxy-auth.ts'

export type MpvFailureKind =
  | 'auto-next'
  | 'initialize'
  | 'load'
  | 'process-crash'
  | 'process-exit'
  | 'restart'
  | 'set-next'

export type MpvLoadLogDetails = {
  proxyAuthorization: 'absent' | 'attached'
  url: string
}

export type MpvReplayGainSettings = {
  defaultGain: number
  enabled: boolean
  preAmp: number
  type: 'album' | 'track'
}

const fallbackFailureKinds = new Set<MpvFailureKind>([
  'initialize',
  'process-crash',
  'process-exit',
  'restart',
])

export const normalizeMpvBinaryPath = (
  value?: null | string,
): string | undefined => {
  const trimmed = value?.trim()

  if (!trimmed) return undefined

  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  const hasMatchingQuotes =
    trimmed.length >= 2 &&
    ((first === '"' && last === '"') || (first === "'" && last === "'"))

  if (!hasMatchingQuotes) return trimmed

  return trimmed.slice(1, -1).trim() || undefined
}

export const shouldFallbackForMpvFailure = (kind: MpvFailureKind): boolean =>
  fallbackFailureKinds.has(kind)

export const resolveMpvInstanceForCommand = async <T>(
  instance: null | T | undefined,
  pendingStartup: null | Promise<T> | undefined,
): Promise<null | T> => {
  if (instance) return instance
  if (pendingStartup) return pendingStartup

  return null
}

export const sanitizeMpvUrlForLog = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl)
    const redactedQuery = parsed.search ? '?<redacted-query>' : ''

    parsed.username = ''
    parsed.password = ''

    return `${parsed.origin}${parsed.pathname}${redactedQuery}`
  } catch {
    return redactProxyAuthFromText(rawUrl)
  }
}

export const redactMpvLogValue = (value: unknown): string => {
  if (typeof value === 'string') return redactProxyAuthFromText(value)

  try {
    return redactProxyAuthFromText(JSON.stringify(value))
  } catch {
    return 'Unknown MPV log value'
  }
}

export const describeMpvLoadForLog = (
  url: string,
  headerFields: string[] = [],
): MpvLoadLogDetails => {
  const hasProxyAuthorization = headerFields.some((field) =>
    field.toLowerCase().startsWith('authorization:'),
  )

  return {
    proxyAuthorization: hasProxyAuthorization ? 'attached' : 'absent',
    url: sanitizeMpvUrlForLog(url),
  }
}

export const createMpvReplayGainProperties = ({
  defaultGain,
  enabled,
  preAmp,
  type,
}: MpvReplayGainSettings): Record<string, number | string> => {
  if (!enabled) {
    return {
      replaygain: 'no',
    }
  }

  return {
    replaygain: type,
    'replaygain-clip': 'yes',
    'replaygain-fallback': defaultGain,
    'replaygain-preamp': preAmp,
  }
}
