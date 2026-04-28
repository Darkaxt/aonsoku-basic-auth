export type AudioEngine = 'mpv' | 'web'

export type AudioEngineResolution = {
  configuredEngine?: AudioEngine
  isDesktop: boolean
  mpvFallback?: boolean
}

export const resolveAudioEngine = ({
  configuredEngine,
  isDesktop,
  mpvFallback,
}: AudioEngineResolution): AudioEngine => {
  if (!isDesktop || mpvFallback) return 'web'

  return configuredEngine ?? 'mpv'
}

export const shouldShowMpvBinaryPath = ({
  isDesktop,
  selectedEngine,
}: {
  isDesktop: boolean
  selectedEngine: AudioEngine
}): boolean => isDesktop && selectedEngine === 'mpv'
