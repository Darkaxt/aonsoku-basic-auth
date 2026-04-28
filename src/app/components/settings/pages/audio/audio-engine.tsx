import { useTranslation } from 'react-i18next'
import {
  Content,
  ContentItem,
  ContentItemForm,
  ContentItemTitle,
  ContentSeparator,
  Header,
  HeaderDescription,
  HeaderTitle,
  Root,
} from '@/app/components/settings/section'
import { Input } from '@/app/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useAudioEngineSettings } from '@/store/player.store'
import { AudioEngine } from '@/utils/audio-engine'
import { isDesktop } from '@/utils/desktop'

const audioEngines: AudioEngine[] = ['mpv', 'web']

export function AudioEngineConfig() {
  const { t } = useTranslation()
  const desktop = isDesktop()
  const { engine, mpvBinaryPath, setEngine, setMpvBinaryPath } =
    useAudioEngineSettings()
  const selectedEngine = desktop ? engine : 'web'

  return (
    <Root>
      <Header>
        <HeaderTitle>{t('settings.audio.engine.group')}</HeaderTitle>
        <HeaderDescription>
          {t('settings.audio.engine.description')}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle info={t('settings.audio.engine.mode.info')}>
            {t('settings.audio.engine.mode.label')}
          </ContentItemTitle>
          <ContentItemForm>
            <Select
              value={selectedEngine}
              onValueChange={(value) => setEngine(value as AudioEngine)}
              disabled={!desktop}
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left">
                <SelectValue>
                  <span className="text-sm text-foreground">
                    {t('settings.audio.engine.mode.' + selectedEngine)}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {audioEngines.map((audioEngine) => (
                    <SelectItem key={audioEngine} value={audioEngine}>
                      {t('settings.audio.engine.mode.' + audioEngine)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle info={t('settings.audio.engine.mpvPath.info')}>
            {t('settings.audio.engine.mpvPath.label')}
          </ContentItemTitle>
          <ContentItemForm className="max-w-72">
            <Input
              value={mpvBinaryPath}
              onChange={(event) => setMpvBinaryPath(event.target.value)}
              placeholder={t('settings.audio.engine.mpvPath.placeholder')}
              disabled={!desktop || selectedEngine !== 'mpv'}
            />
          </ContentItemForm>
        </ContentItem>
      </Content>

      <ContentSeparator />
    </Root>
  )
}
