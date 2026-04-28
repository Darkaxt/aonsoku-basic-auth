import { BrowserWindow, app, ipcMain } from 'electron'
import { rm } from 'node:fs/promises'
import { pid } from 'node:process'
import MpvAPI from 'node-mpv'
import { IpcChannels, MpvInitializePayload } from '../../preload/types'
import { redactProxyAuthFromText } from '../../../src/utils/proxy-auth'
import { getMpvProxyAuthHeaderFields } from './proxy-auth'

type NodeMpvError = {
  errcode?: number
  method?: string
  stackTrace?: string
  verbose?: string
}

let mpvInstance: MpvAPI | null = null
let rendererWindow: BrowserWindow | null = null

const isWindows = process.platform === 'win32'
const socketPath = isWindows
  ? `\\\\.\\pipe\\aonsoku-mpv-${pid}`
  : `/tmp/aonsoku-mpv-${pid}.sock`

const defaultMpvParameters = [
  '--idle=yes',
  '--no-config',
  '--load-scripts=no',
  '--prefetch-playlist=yes',
]

function sendToRenderer(channel: IpcChannels, ...args: unknown[]) {
  if (!rendererWindow || rendererWindow.isDestroyed()) return

  rendererWindow.webContents.send(channel, ...args)
}

function safeText(value: unknown): string {
  if (typeof value === 'string') return redactProxyAuthFromText(value)

  try {
    return redactProxyAuthFromText(JSON.stringify(value))
  } catch {
    return 'Unknown MPV error'
  }
}

function reportMpvError(action: string, error?: unknown) {
  const suffix = error ? `: ${safeText(error as NodeMpvError)}` : ''
  const message = `MPV ${action} failed${suffix}`

  console.error(`[mpv] ${message}`)
  sendToRenderer(IpcChannels.MpvPlayerError, message)
}

function setFallback(isFallback: boolean) {
  sendToRenderer(IpcChannels.MpvPlayerFallback, isFallback)
}

function getMpvInstance() {
  return mpvInstance
}

async function quit(instance = getMpvInstance()) {
  if (!instance) return

  try {
    await instance.quit()
  } catch {
    const processRef = (instance as unknown as { process?: NodeJS.Process })
      .process

    if (typeof processRef?.kill === 'function') {
      processRef.kill('SIGTERM')
    }
  }

  if (!isWindows) {
    await rm(socketPath).catch(() => undefined)
  }
}

async function createMpv(payload: MpvInitializePayload = {}) {
  const binaryPath = payload.binaryPath?.trim() || undefined
  const mpv = new MpvAPI(
    {
      audio_only: true,
      auto_restart: false,
      binary: binaryPath,
      socket: socketPath,
      time_update: 1,
    },
    defaultMpvParameters,
  )

  await mpv.start()

  if (payload.properties) {
    await mpv.setMultipleProperties(payload.properties)
  }

  mpv.on('status', (status) => {
    if (status.property !== 'playlist-pos') return

    if (status.value === -1) {
      mpv.pause().catch(() => undefined)
      return
    }

    if (typeof status.value === 'number' && status.value > 0) {
      sendToRenderer(IpcChannels.MpvPlayerAutoNext)
    }
  })

  mpv.on('resumed', () => {
    sendToRenderer(IpcChannels.MpvPlayerPlay)
  })

  mpv.on('paused', () => {
    sendToRenderer(IpcChannels.MpvPlayerPause)
  })

  mpv.on('stopped', () => {
    sendToRenderer(IpcChannels.MpvPlayerStop)
  })

  mpv.on('timeposition', (time: number) => {
    sendToRenderer(IpcChannels.MpvPlayerCurrentTime, time)
  })

  return mpv
}

function loadOptionsForUrl(url: string): string[] | undefined {
  const headerFields = getMpvProxyAuthHeaderFields(url)

  if (headerFields.length === 0) return undefined

  return [`http-header-fields=${headerFields.join(',')}`]
}

async function loadUrl(url: string, mode: 'append' | 'replace') {
  const mpv = getMpvInstance()

  if (!mpv) throw new Error('MPV is not initialized')

  await mpv.load(url, mode, loadOptionsForUrl(url))
}

async function initialize(payload: MpvInitializePayload = {}) {
  if (mpvInstance?.isRunning()) return

  mpvInstance = await createMpv(payload)
  setFallback(false)
}

async function restart(payload: MpvInitializePayload = {}) {
  const previous = mpvInstance
  mpvInstance = null

  await previous?.stop().catch(() => undefined)
  await quit(previous)

  mpvInstance = await createMpv(payload)
  setFallback(false)
}

function resetMpvIpc() {
  const eventsToReset = [
    IpcChannels.MpvPlayerSetProperties,
    IpcChannels.MpvPlayerQuit,
    IpcChannels.MpvPlayerCleanup,
    IpcChannels.MpvPlayerPlay,
    IpcChannels.MpvPlayerPause,
    IpcChannels.MpvPlayerStop,
    IpcChannels.MpvPlayerSeek,
    IpcChannels.MpvPlayerSeekTo,
    IpcChannels.MpvPlayerVolume,
    IpcChannels.MpvPlayerMute,
    IpcChannels.MpvPlayerSetQueue,
    IpcChannels.MpvPlayerSetQueueNext,
    IpcChannels.MpvPlayerAutoNext,
  ]

  eventsToReset.forEach((channel) => ipcMain.removeAllListeners(channel))

  ipcMain.removeHandler(IpcChannels.MpvPlayerInitialize)
  ipcMain.removeHandler(IpcChannels.MpvPlayerRestart)
  ipcMain.removeHandler(IpcChannels.MpvPlayerIsRunning)
  ipcMain.removeHandler(IpcChannels.MpvPlayerGetCurrentTime)
}

export function setupMpvPlayerIpc(window: BrowserWindow | null) {
  rendererWindow = window

  resetMpvIpc()

  ipcMain.handle(IpcChannels.MpvPlayerInitialize, async (_event, payload) => {
    try {
      await initialize(payload)
      return true
    } catch (error) {
      reportMpvError('initialize', error)
      setFallback(true)
      return false
    }
  })

  ipcMain.handle(IpcChannels.MpvPlayerRestart, async (_event, payload) => {
    try {
      await restart(payload)
      return true
    } catch (error) {
      reportMpvError('restart', error)
      setFallback(true)
      return false
    }
  })

  ipcMain.handle(IpcChannels.MpvPlayerIsRunning, () => {
    return Boolean(getMpvInstance()?.isRunning())
  })

  ipcMain.handle(IpcChannels.MpvPlayerGetCurrentTime, async () => {
    try {
      return await getMpvInstance()?.getTimePosition()
    } catch {
      return undefined
    }
  })

  ipcMain.on(IpcChannels.MpvPlayerSetProperties, async (_event, properties) => {
    try {
      await getMpvInstance()?.setMultipleProperties(properties)
    } catch (error) {
      reportMpvError('set properties', error)
    }
  })

  ipcMain.on(IpcChannels.MpvPlayerQuit, async () => {
    try {
      await getMpvInstance()?.stop()
      await quit()
    } catch (error) {
      reportMpvError('quit', error)
    } finally {
      mpvInstance = null
    }
  })

  ipcMain.on(IpcChannels.MpvPlayerCleanup, async () => {
    await getMpvInstance()?.stop().catch(() => undefined)
    await getMpvInstance()?.clearPlaylist().catch(() => undefined)
  })

  ipcMain.on(IpcChannels.MpvPlayerPlay, async () => {
    await getMpvInstance()?.play().catch((error) => reportMpvError('play', error))
  })

  ipcMain.on(IpcChannels.MpvPlayerPause, async () => {
    await getMpvInstance()
      ?.pause()
      .catch((error) => reportMpvError('pause', error))
  })

  ipcMain.on(IpcChannels.MpvPlayerStop, async () => {
    await getMpvInstance()?.stop().catch((error) => reportMpvError('stop', error))
  })

  ipcMain.on(IpcChannels.MpvPlayerSeek, async (_event, seconds: number) => {
    await getMpvInstance()
      ?.seek(seconds)
      .catch((error) => reportMpvError('seek', error))
  })

  ipcMain.on(IpcChannels.MpvPlayerSeekTo, async (_event, seconds: number) => {
    await getMpvInstance()
      ?.goToPosition(seconds)
      .catch((error) => reportMpvError('seek to', error))
  })

  ipcMain.on(IpcChannels.MpvPlayerVolume, async (_event, value: number) => {
    await getMpvInstance()
      ?.volume(Math.max(0, Math.min(100, value)))
      .catch((error) => reportMpvError('volume', error))
  })

  ipcMain.on(IpcChannels.MpvPlayerMute, async (_event, muted: boolean) => {
    await getMpvInstance()
      ?.mute(muted)
      .catch((error) => reportMpvError('mute', error))
  })

  ipcMain.on(
    IpcChannels.MpvPlayerSetQueue,
    async (_event, current?: string, next?: string, pause?: boolean) => {
      try {
        if (!current && !next) {
          await getMpvInstance()?.clearPlaylist()
          await getMpvInstance()?.pause()
          return
        }

        if (current) {
          await loadUrl(current, 'replace')
        }

        if (next) {
          await loadUrl(next, 'append')
        }

        if (pause) {
          await getMpvInstance()?.pause()
        } else if (pause === false) {
          await getMpvInstance()?.play()
        }
      } catch (error) {
        reportMpvError('set queue', error)
        setFallback(true)
      }
    },
  )

  ipcMain.on(IpcChannels.MpvPlayerSetQueueNext, async (_event, url?: string) => {
    try {
      const size = await getMpvInstance()?.getPlaylistSize()

      if (size && size > 1) {
        await getMpvInstance()?.playlistRemove(1)
      }

      if (url) {
        await loadUrl(url, 'append')
      }
    } catch (error) {
      reportMpvError('set next queue item', error)
    }
  })

  ipcMain.on(IpcChannels.MpvPlayerAutoNext, async (_event, url?: string) => {
    try {
      await getMpvInstance()?.playlistRemove(0).catch(() => undefined)

      if (url) {
        await loadUrl(url, 'append')
      }
    } catch (error) {
      reportMpvError('auto next', error)
    }
  })
}

app.on('before-quit', () => {
  quit().catch(() => undefined)
})
