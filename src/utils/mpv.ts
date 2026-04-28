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
