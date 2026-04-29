import { useAppStore } from '@/store/app.store'

export function checkServerType() {
  const { serverType } = useAppStore.getState().data

  const isSubsonic = serverType === 'subsonic'
  const isNavidrome = serverType === 'navidrome'
  const isLms = serverType === 'lms'

  return {
    isSubsonic,
    isNavidrome,
    isLms,
  }
}

export function getServerExtensions() {
  const { extensionsSupported } = useAppStore.getState().data
  const songLyricsVersions = extensionsSupported?.songLyrics ?? []

  const songLyricsEnabled =
    extensionsSupported && songLyricsVersions.length > 0
  const songLyricsEnhancedEnabled = songLyricsVersions.some(
    (version) => version >= 2,
  )

  return {
    songLyricsEnhancedEnabled,
    songLyricsEnabled,
  }
}
