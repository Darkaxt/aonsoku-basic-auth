import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { getSongStreamUrl } from '@/api/httpClient'
import {
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerSonglist,
  usePlayerStore,
  usePlayerVolume,
} from '@/store/player.store'
import { LoopState } from '@/types/playerContext'
import { ISong } from '@/types/responses/song'
import { logger } from '@/utils/logger'

type MpvAudioPlayerProps = {
  binaryPath?: string
  onFallback: (enabled: boolean) => void
  song: ISong
}

const resolveNextSong = (
  currentList: ISong[],
  currentSongIndex: number,
  loopState: LoopState,
) => {
  if (currentList.length === 0) return undefined

  const nextSong = currentList[currentSongIndex + 1]

  if (nextSong) return nextSong

  if (loopState === LoopState.All) return currentList[0]

  return undefined
}

const getNextSongFromStore = () => {
  const { songlist, playerState } = usePlayerStore.getState()

  return resolveNextSong(
    songlist.currentList,
    songlist.currentSongIndex,
    playerState.loopState,
  )
}

const getRawSongUrl = (song?: ISong) =>
  song?.id ? getSongStreamUrl(song.id) : undefined

export function MpvAudioPlayer({
  binaryPath,
  onFallback,
  song,
}: MpvAudioPlayerProps) {
  const { t } = useTranslation()
  const isPlaying = usePlayerIsPlaying()
  const loopState = usePlayerLoop()
  const { currentList, currentSongIndex } = usePlayerSonglist()
  const {
    handleSongEnded,
    setCurrentDuration,
    setPlayingState,
    setProgress,
  } = usePlayerActions()
  const { volume } = usePlayerVolume()
  const skipQueueReplaceRef = useRef(false)
  const isPlayingRef = useRef(isPlaying)
  const nextUrlRef = useRef<string | undefined>(undefined)

  const currentUrl = useMemo(() => getRawSongUrl(song), [song])
  const nextUrl = useMemo(
    () => getRawSongUrl(resolveNextSong(currentList, currentSongIndex, loopState)),
    [currentList, currentSongIndex, loopState],
  )

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    nextUrlRef.current = nextUrl
  }, [nextUrl])

  useEffect(() => {
    window.api.mpvPlayer
      .initialize({ binaryPath })
      .then((initialized) => {
        if (!initialized) onFallback(true)
      })
      .catch((error) => {
        logger.error('MPV initialization failed', error)
        onFallback(true)
      })

    return () => {
      window.api.mpvPlayer.quit()
    }
  }, [binaryPath, onFallback])

  useEffect(() => {
    const removeAutoNext = window.api.mpvPlayerListener.onAutoNext(() => {
      skipQueueReplaceRef.current = true
      handleSongEnded()

      setTimeout(() => {
        window.api.mpvPlayer.autoNext(getRawSongUrl(getNextSongFromStore()))
      }, 0)
    })
    const removeCurrentTime = window.api.mpvPlayerListener.onCurrentTime(
      (time) => {
        setProgress(Math.floor(time))
      },
    )
    const removePlay = window.api.mpvPlayerListener.onPlay(() => {
      setPlayingState(true)
    })
    const removePause = window.api.mpvPlayerListener.onPause(() => {
      setPlayingState(false)
    })
    const removeStop = window.api.mpvPlayerListener.onStop(() => {
      setPlayingState(false)
    })
    const removeFallback = window.api.mpvPlayerListener.onFallback((enabled) => {
      onFallback(enabled)

      if (enabled) {
        toast.warn(t('warnings.mpvFallback'))
      }
    })
    const removeError = window.api.mpvPlayerListener.onError((message) => {
      logger.error('MPV playback error', message)
    })

    return () => {
      removeAutoNext()
      removeCurrentTime()
      removePlay()
      removePause()
      removeStop()
      removeFallback()
      removeError()
    }
  }, [handleSongEnded, onFallback, setPlayingState, setProgress, t])

  useEffect(() => {
    if (!currentUrl) {
      window.api.mpvPlayer.cleanup()
      return
    }

    setCurrentDuration(song.duration ?? 0)

    if (skipQueueReplaceRef.current) {
      skipQueueReplaceRef.current = false
      return
    }

    window.api.mpvPlayer.setQueue(
      currentUrl,
      nextUrlRef.current,
      !isPlayingRef.current,
    )
  }, [currentUrl, setCurrentDuration, song.duration])

  useEffect(() => {
    if (!currentUrl) return

    window.api.mpvPlayer.setQueueNext(nextUrl)
  }, [currentUrl, nextUrl])

  useEffect(() => {
    if (isPlaying) {
      window.api.mpvPlayer.play()
    } else {
      window.api.mpvPlayer.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    window.api.mpvPlayer.volume(volume)
  }, [volume])

  useEffect(() => {
    window.api.mpvPlayer.setProperties({
      loop: loopState === LoopState.One ? 'inf' : 'no',
    })
  }, [loopState])

  return <div data-testid="player-song-mpv" hidden />
}
