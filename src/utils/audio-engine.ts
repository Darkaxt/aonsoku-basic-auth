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
  isMpvOnPath,
  isDesktop,
  selectedEngine,
}: {
  isMpvOnPath: boolean
  isDesktop: boolean
  selectedEngine: AudioEngine
}): boolean => isDesktop && selectedEngine === 'mpv' && !isMpvOnPath
