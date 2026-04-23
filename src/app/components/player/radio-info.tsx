import { RadioIcon } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MarqueeTitle } from "@/app/components/fullscreen/marquee-title.tsx"
import { Radio } from '@/types/responses/radios'
import IcecastMetadataStats from 'icecast-metadata-stats'

export function RadioInfo({ radio }: { radio: Radio | undefined }) {
  const { t } = useTranslation()
  const [radioMetadata , setRadioMetadata] = useState({title: null, artist: null})
  const streamUrl = radio?.streamUrl

  useEffect(() => {
    if (!streamUrl) {
      setRadioMetadata({title: null, artist: null})
      return
    }
    let iceListener: IcecastMetadataStats

    try {
      iceListener = new IcecastMetadataStats(streamUrl, {
        interval: 10,
        onStats: (stats) => {
          const streamTitle = stats.StreamTitle ? stats.StreamTitle : stats.icy?.StreamTitle
          if (streamTitle) {
            const i = streamTitle.indexOf(' - ')

            if (i < 0) {
              setRadioMetadata({title: streamTitle.trim(), artist: null})
            } else {
              const trackArtist = streamTitle.slice(0, i).trim()
              const trackTitle = streamTitle.slice(i + 3).trim()
              setRadioMetadata({title: trackTitle, artist: trackArtist})
            }
          } else {
            setRadioMetadata({title: null, artist: null})
          }
        },
        sources: ['icy'],
      })

      iceListener.start()
    } catch {
      setRadioMetadata({title: null, artist: null})
    }

    return () => {
      if (iceListener) {
        iceListener.stop()
      }
      setRadioMetadata({title: null, artist: null})
    }
  }, [streamUrl])

  return (
    <Fragment>
      <div className="w-[70px] h-[70px] flex justify-center items-center bg-foreground/20 rounded">
        <RadioIcon
          className="w-12 h-12"
          strokeWidth={1}
          data-testid="radio-icon"
        />
      </div>
      <div className="flex flex-col w-[66%] max-w-full justify-end text-left overflow-hidden">
        {radio ? (
          <Fragment>
            <MarqueeTitle gap="mr-6" >
              <span className="text-sm font-medium" data-testid="radio-title">
                { radioMetadata.title && radioMetadata.title !== "" ? radioMetadata.title : "—" }
              </span>
            </MarqueeTitle>
            <span
              className="text-xs font-light text-muted-foreground"
              data-testid="radio-artist"
            >
              { radioMetadata.artist && radioMetadata.artist !== "" ? radioMetadata.artist : "" }
            </span>
            <span
              className="text-xs font-light text-muted-foreground"
              data-testid="radio-name"
            >
              { radio.name }
            </span>
          </Fragment>
        ) : (
          <span className="text-sm font-medium" data-testid="radio-no-playing">
            {t('player.noRadioPlaying')}
          </span>
        )}
      </div>
    </Fragment>
  )
}
