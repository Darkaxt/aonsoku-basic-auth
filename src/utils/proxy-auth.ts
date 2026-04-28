export const PROXY_BASIC_AUTH_SECRET_KEY = 'proxy-basic-auth:server'

export type ProxyBasicAuthConfig = {
  enabled: boolean
  type: 'basic'
  username: string
}

export type ProxyAuthServer = {
  proxyAuth?: ProxyBasicAuthConfig
  url?: string
}

export type ProxyAuthRequestConfig = {
  enabled?: boolean
  origins: string[]
  password?: string
  username: string
}

export type SanitizedServerUrl = {
  proxyPassword?: string
  proxyUsername?: string
  url: string
}

type RequestHeaders = Record<string, string | string[] | undefined>

type GlobalWithEncoding = typeof globalThis & {
  btoa?: (input: string) => string
  Buffer?: {
    from: (
      input: string,
      encoding: 'utf8',
    ) => { toString: (encoding: 'base64') => string }
  }
}

const httpProtocols = new Set(['http:', 'https:'])

const stripTrailingSlash = (value: string) => value.replace(/\/$/, '')

const toUrl = (rawUrl?: string): URL | null => {
  const trimmed = rawUrl?.trim()

  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)

    if (!httpProtocols.has(parsed.protocol)) return null

    return parsed
  } catch {
    return null
  }
}

export const sanitizeServerUrl = (rawUrl: string): SanitizedServerUrl => {
  const parsed = toUrl(rawUrl)

  if (!parsed) {
    return { url: stripTrailingSlash(rawUrl.trim()) }
  }

  const proxyUsername = parsed.username
    ? decodeURIComponent(parsed.username)
    : undefined
  const proxyPassword = parsed.password
    ? decodeURIComponent(parsed.password)
    : undefined

  parsed.username = ''
  parsed.password = ''

  return {
    ...(proxyPassword && { proxyPassword }),
    ...(proxyUsername && { proxyUsername }),
    url: stripTrailingSlash(parsed.toString()),
  }
}

export const normalizeUrlToOrigin = (rawUrl?: string): string | null => {
  const parsed = toUrl(rawUrl)

  if (!parsed) return null

  parsed.username = ''
  parsed.password = ''

  return parsed.origin
}

export const getProxyAuthOrigins = (server: ProxyAuthServer): string[] => {
  if (!server.proxyAuth?.enabled || !server.proxyAuth.username.trim()) {
    return []
  }

  const origins = [normalizeUrlToOrigin(server.url)]

  return [...new Set(origins.filter((origin): origin is string => !!origin))]
}

export const hasAuthorizationHeader = (headers: RequestHeaders): boolean => {
  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization')
}

export const createBasicAuthorizationHeader = (
  username: string,
  password: string,
): string => {
  const value = `${username}:${password}`
  const globalEncoding = globalThis as GlobalWithEncoding

  if (globalEncoding.Buffer) {
    return `Basic ${globalEncoding.Buffer.from(value, 'utf8').toString('base64')}`
  }

  const btoa = globalEncoding.btoa

  if (!btoa) {
    throw new Error('No base64 encoder is available')
  }

  const bytes = new TextEncoder().encode(value)
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('')

  return `Basic ${btoa(binary)}`
}

export const createProxyAuthHeaderForRequest = (
  requestUrl: string,
  requestHeaders: RequestHeaders,
  config: ProxyAuthRequestConfig,
): string | undefined => {
  if (
    !config.enabled ||
    !config.username.trim() ||
    !config.password ||
    hasAuthorizationHeader(requestHeaders)
  ) {
    return undefined
  }

  const origin = normalizeUrlToOrigin(requestUrl)
  const origins = config.origins
    .map((configuredOrigin) => normalizeUrlToOrigin(configuredOrigin))
    .filter((configuredOrigin): configuredOrigin is string => !!configuredOrigin)

  if (!origin || !origins.includes(origin)) {
    return undefined
  }

  return createBasicAuthorizationHeader(config.username, config.password)
}

export const createMpvHttpHeaderFieldsForRequest = (
  requestUrl: string,
  config: ProxyAuthRequestConfig,
): string[] => {
  const header = createProxyAuthHeaderForRequest(requestUrl, {}, config)

  if (!header) return []

  return [`Authorization: ${header}`]
}

export const withUrlBasicAuth = (
  rawUrl: string,
  username: string,
  password: string,
): string => {
  if (!username.trim() || !password) return rawUrl

  const parsed = toUrl(rawUrl)

  if (!parsed) return rawUrl

  parsed.username = username
  parsed.password = password

  return parsed.toString()
}

export const redactProxyAuthFromText = (value: string): string => {
  return value
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/g, 'Basic <redacted>')
    .replace(/(https?:\/\/)([^:@/\s]+):([^@/\s]+)@/gi, '$1<proxy-auth>@')
    .replace(
      /([?&](?:u|p|t|s)=)([^&#\s]+)/gi,
      (_match, prefix) => `${prefix}<redacted>`,
    )
}
