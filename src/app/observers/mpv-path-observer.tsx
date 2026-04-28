import { useEffect } from 'react'
import { useAudioEngineSettings } from '@/store/player.store'

export function MpvPathObserver() {
  const { engine, mpvBinaryPath, setMpvBinaryPath } = useAudioEngineSettings()

  useEffect(() => {
    let isMounted = true

    if (engine !== 'mpv' || !mpvBinaryPath) return

    window.api.mpvPlayer
      .isOnPath()
      .then((found) => {
        if (isMounted && found) {
          setMpvBinaryPath('')
        }
      })
      .catch(() => undefined)

    return () => {
      isMounted = false
    }
  }, [engine, mpvBinaryPath, setMpvBinaryPath])

  return null
}
