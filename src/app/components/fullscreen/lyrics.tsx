import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ComponentPropsWithoutRef, useEffect, useRef, useState } from 'react'
import { isSafari } from 'react-device-detect'
import { useTranslation } from 'react-i18next'
import { Lrc } from 'react-lrc'
import {
  ScrollArea,
  scrollAreaViewportSelector,
} from '@/app/components/ui/scroll-area'
import { subsonic } from '@/service/subsonic'
import { usePlayerRef, usePlayerSonglist } from '@/store/player.store'
import { ILyric } from '@/types/responses/song'
import { isSyncedLyricsValue, LYRIC_LINE_BREAK } from '@/utils/lyrics'

interface LyricProps {
  lyrics: ILyric
}

export function LyricsTab() {
  const { currentSong } = usePlayerSonglist()
  const { t } = useTranslation()

  const { id, artist, title, duration } = currentSong

  const { data: lyrics, isLoading } = useQuery({
    queryKey: ['get-lyrics', artist, title, duration],
    queryFn: () =>
      subsonic.lyrics.getLyrics({
        id,
        artist,
        title,
        duration,
      }),
  })

  const noLyricsFound = t('fullscreen.noLyrics')
  const loadingLyrics = t('fullscreen.loadingLyrics')

  if (isLoading) {
    return <CenteredMessage>{loadingLyrics}</CenteredMessage>
  } else if (lyrics && lyrics.value) {
    return areLyricsSynced(lyrics) ? (
      <SyncedLyrics lyrics={lyrics} />
    ) : (
      <UnsyncedLyrics lyrics={lyrics} />
    )
  } else {
    return <CenteredMessage>{noLyricsFound}</CenteredMessage>
  }
}

function SyncedLyrics({ lyrics }: LyricProps) {
  const playerRef = usePlayerRef()
  const [progress, setProgress] = useState(0)

  setTimeout(() => {
    let newProgress = (playerRef?.currentTime || 0) * 1000

    if (newProgress === progress) {
      newProgress += 1 // Prevents the lyrics from getting stuck when the audio is still loading
    }

    setProgress(newProgress)
  }, 50)

  const skipToTime = (timeMs: number) => {
    if (playerRef) {
      playerRef!.currentTime = timeMs / 1000
    }
  }

  return (
    <div className="w-full h-full text-center font-semibold text-2xl 2xl:text-3xl px-2 lrc-box maskImage-big-player-lyrics">
      <Lrc
        lrc={lyrics.value!}
        recoverAutoScrollInterval={1500}
        currentMillisecond={progress}
        id="sync-lyrics-box"
        className={clsx('h-full overflow-y-auto', !isSafari && 'scroll-smooth')}
        verticalSpace={true}
        lineRenderer={({ active, line }) => (
          <p
            onClick={() => skipToTime(line.startMillisecond)}
            className={clsx(
              'text-shadow-lg my-5 cursor-pointer hover:opacity-100 duration-500',
              'transition-[opacity,transform] motion-reduce:transition-none',
              active ? 'opacity-100 scale-125' : 'opacity-50',
            )}
          >
            <LyricLineText
              text={line.content}
              translationClassName="block text-base 2xl:text-xl opacity-80 mt-1 leading-snug"
            />
          </p>
        )}
      />
    </div>
  )
}

function UnsyncedLyrics({ lyrics }: LyricProps) {
  const { currentSong } = usePlayerSonglist()
  const lyricsBoxRef = useRef<HTMLDivElement>(null)

  const lines = lyrics.value!.split('\n')

  // biome-ignore lint/correctness/useExhaustiveDependencies: recomputed when song changes
  useEffect(() => {
    if (lyricsBoxRef.current) {
      const scrollArea = lyricsBoxRef.current.querySelector(
        scrollAreaViewportSelector,
      ) as HTMLDivElement

      scrollArea.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }, [currentSong])

  return (
    <ScrollArea
      type="always"
      className="w-full h-full overflow-y-auto text-center font-semibold text-xl 2xl:text-2xl px-2 scroll-smooth maskImage-unsynced-lyrics"
      thumbClassName="secondary-thumb-bar"
      ref={lyricsBoxRef}
    >
      {lines.map((line, index) => (
        <p
          key={index}
          className={clsx(
            'leading-10 text-shadow-lg text-balance',
            index === 0 && 'mt-4',
            index === lines.length - 1 && 'mb-16',
          )}
        >
          <LyricLineText
            text={line}
            translationClassName="block text-base 2xl:text-lg opacity-80 leading-snug"
          />
        </p>
      ))}
    </ScrollArea>
  )
}

type CenteredMessageProps = ComponentPropsWithoutRef<'p'>

function CenteredMessage({ children }: CenteredMessageProps) {
  return (
    <div className="w-full h-full flex justify-center items-center">
      <p className="leading-10 text-shadow-lg text-center font-semibold text-xl 2xl:text-2xl">
        {children}
      </p>
    </div>
  )
}

function areLyricsSynced(lyrics: ILyric) {
  return isSyncedLyricsValue(lyrics.value ?? '')
}

function LyricLineText({
  text,
  translationClassName,
}: {
  text: string
  translationClassName: string
}) {
  const lines = text.split(LYRIC_LINE_BREAK)

  return (
    <>
      {lines.map((line, index) => (
        <span
          key={`${index}-${line}`}
          className={clsx(index > 0 && translationClassName)}
        >
          {line}
        </span>
      ))}
    </>
  )
}
