import { BrowserWindow, app, ipcMain } from 'electron'
import { access, appendFile, mkdir, rm } from 'node:fs/promises'
import { delimiter, dirname, join } from 'node:path'
import { pid } from 'node:process'
import MpvAPI from 'node-mpv'
import { IpcChannels, MpvInitializePayload } from '../../preload/types'
import {
  describeMpvLoadForLog,
  normalizeMpvBinaryPath,
  redactMpvLogValue,
  resolveMpvInstanceForCommand,
  shouldFallbackForMpvFailure,
} from '../../../src/utils/mpv'
import { getMpvProxyAuthHeaderFields } from './proxy-auth'

type NodeMpvError = {
  errcode?: number
  method?: string
  stackTrace?: string
  verbose?: string
}

type MpvCommandApi = MpvAPI & {
  command: (command: string, args?: unknown[]) => Promise<unknown>
  setProperty: (property: string, value: unknown) => Promise<unknown>
}

let mpvInstance: MpvAPI | null = null
let mpvStartupPromise: Promise<MpvAPI> | null = null
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

const mpvBinaryNames = isWindows
  ? ['mpv.com', 'mpv.exe', 'mpv.cmd', 'mpv.bat']
  : ['mpv']

function sendToRenderer(channel: IpcChannels, ...args: unknown[]) {
  if (!rendererWindow || rendererWindow.isDestroyed()) return

  rendererWindow.webContents.send(channel, ...args)
}

function getMpvLogPath(): string {
  const logDirectory = app.getPath('logs') || join(app.getPath('userData'), 'logs')

  return join(logDirectory, 'mpv.log')
}

async function writeMpvLog(
  level: 'error' | 'info' | 'warn',
  message: string,
  details?: unknown,
) {
  const detailsText = details === undefined ? '' : ` ${redactMpvLogValue(details)}`
  const line = `${new Date().toISOString()} [${level}] ${message}${detailsText}\n`

  if (level === 'error') {
    console.error(`[mpv] ${message}${detailsText}`)
  } else if (level === 'warn') {
    console.warn(`[mpv] ${message}${detailsText}`)
  } else {
    console.info(`[mpv] ${message}${detailsText}`)
  }

  try {
    const logPath = getMpvLogPath()
    await mkdir(dirname(logPath), { recursive: true })
    await appendFile(logPath, line, 'utf8')
  } catch (error) {
    console.warn('[mpv] Failed to write MPV log', redactMpvLogValue(error))
  }
}

function logMpv(
  level: 'error' | 'info' | 'warn',
  message: string,
  details?: unknown,
) {
  writeMpvLog(level, message, details).catch((error) => {
    console.warn('[mpv] Failed to queue MPV log write', redactMpvLogValue(error))
  })
}

function reportMpvError(action: string, error?: unknown) {
  const suffix = error ? `: ${redactMpvLogValue(error as NodeMpvError)}` : ''
  const message = `MPV ${action} failed${suffix}`

  logMpv('error', message)
  sendToRenderer(IpcChannels.MpvPlayerError, message)
}

function setFallback(isFallback: boolean) {
  logMpv('warn', 'MPV fallback state changed', { enabled: isFallback })
  sendToRenderer(IpcChannels.MpvPlayerFallback, isFallback)
}

function getMpvInstance() {
  return mpvInstance
}

async function findMpvOnPath(): Promise<string | undefined> {
  const pathEntries = (process.env.PATH ?? '')
    .split(delimiter)
    .map((entry) => normalizeMpvBinaryPath(entry))
    .filter((entry): entry is string => Boolean(entry))

  for (const pathEntry of pathEntries) {
    for (const binaryName of mpvBinaryNames) {
      const candidate = join(pathEntry, binaryName)

      try {
        await access(candidate)
        return candidate
      } catch {
        // Continue scanning PATH entries.
      }
    }
  }

  return undefined
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

function headersFromMpvHeaderFields(headerFields: string[]) {
  const headers: Record<string, string> = {
    Range: 'bytes=0-0',
  }

  headerFields.forEach((field) => {
    const separatorIndex = field.indexOf(':')

    if (separatorIndex <= 0) return

    const name = field.slice(0, separatorIndex).trim()
    const value = field.slice(separatorIndex + 1).trim()

    if (name && value) {
      headers[name] = value
    }
  })

  return headers
}

async function runMpvLoadDiagnostic(url: string, headerFields: string[]) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  const loadDetails = describeMpvLoadForLog(url, headerFields)

  try {
    const response = await fetch(url, {
      headers: headersFromMpvHeaderFields(headerFields),
      signal: controller.signal,
    })

    logMpv('warn', 'MPV load diagnostic completed', {
      ...loadDetails,
      status: response.status,
      statusText: response.statusText,
    })

    await response.body?.cancel().catch(() => undefined)
  } catch (error) {
    logMpv('warn', 'MPV load diagnostic failed', {
      ...loadDetails,
      error: redactMpvLogValue(error),
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function createMpv(payload: MpvInitializePayload = {}) {
  const binaryPath = normalizeMpvBinaryPath(payload.binaryPath)

  logMpv('info', 'Starting MPV', {
    binaryPath: binaryPath ?? 'mpv from PATH',
    socketPath,
  })

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
  logMpv('info', 'MPV started', { socketPath })

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

  mpv.on('crashed', () => {
    logMpv('error', 'MPV process crashed')

    if (mpvInstance === mpv) {
      mpvInstance = null
    }

    if (shouldFallbackForMpvFailure('process-crash')) {
      setFallback(true)
    }

    sendToRenderer(
      IpcChannels.MpvPlayerError,
      'MPV process crashed. Falling back to Web playback for this session.',
    )
  })

  mpv.on('quit', () => {
    logMpv('warn', 'MPV process exited')

    if (mpvInstance === mpv) {
      mpvInstance = null
    }

    if (shouldFallbackForMpvFailure('process-exit')) {
      setFallback(true)
    }

    sendToRenderer(
      IpcChannels.MpvPlayerError,
      'MPV process exited. Falling back to Web playback for this session.',
    )
  })

  return mpv
}

async function loadUrl(url: string, mode: 'append' | 'replace') {
  const mpv = await resolveMpvInstanceForCommand(
    getMpvInstance(),
    mpvStartupPromise,
  )
  const headerFields = getMpvProxyAuthHeaderFields(url)
  const loadDetails = describeMpvLoadForLog(url, headerFields)

  if (!mpv) throw new Error('MPV is not initialized')

  const mpvCommandApi = mpv as MpvCommandApi

  logMpv('info', 'Loading MPV URL', {
    ...loadDetails,
    mode,
  })

  try {
    await mpvCommandApi.setProperty('http-header-fields', headerFields)
    await mpvCommandApi.command('loadfile', [url, mode])
    logMpv('info', 'MPV load command accepted', { ...loadDetails, mode })
  } catch (error) {
    logMpv('warn', 'MPV load command rejected', {
      ...loadDetails,
      error: redactMpvLogValue(error),
      mode,
    })
    runMpvLoadDiagnostic(url, headerFields).catch((diagnosticError) => {
      logMpv('warn', 'MPV load diagnostic failed unexpectedly', {
        error: redactMpvLogValue(diagnosticError),
      })
    })
    throw error
  }
}

async function startMpv(payload: MpvInitializePayload = {}) {
  if (mpvInstance?.isRunning()) return mpvInstance
  if (mpvStartupPromise) return mpvStartupPromise

  const startup = createMpv(payload).finally(() => {
    if (mpvStartupPromise === startup) {
      mpvStartupPromise = null
    }
  })

  mpvStartupPromise = startup
  mpvInstance = await startup
  setFallback(false)

  return mpvInstance
}

async function initialize(payload: MpvInitializePayload = {}) {
  await startMpv(payload)
}

async function restart(payload: MpvInitializePayload = {}) {
  const previous = mpvInstance
  mpvInstance = null
  mpvStartupPromise = null

  await previous?.stop().catch(() => undefined)
  await quit(previous)

  await startMpv(payload)
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
  ipcMain.removeHandler(IpcChannels.MpvPlayerIsOnPath)
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
      if (shouldFallbackForMpvFailure('initialize')) {
        setFallback(true)
      }
      return false
    }
  })

  ipcMain.handle(IpcChannels.MpvPlayerRestart, async (_event, payload) => {
    try {
      await restart(payload)
      return true
    } catch (error) {
      reportMpvError('restart', error)
      if (shouldFallbackForMpvFailure('restart')) {
        setFallback(true)
      }
      return false
    }
  })

  ipcMain.handle(IpcChannels.MpvPlayerIsRunning, () => {
    return Boolean(getMpvInstance()?.isRunning())
  })

  ipcMain.handle(IpcChannels.MpvPlayerIsOnPath, async () => {
    const binaryPath = await findMpvOnPath()

    logMpv('info', 'MPV PATH check completed', {
      found: Boolean(binaryPath),
      binaryPath: binaryPath ?? 'not found',
    })

    return Boolean(binaryPath)
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
          await loadUrl(current, 'replace').catch(async (error) => {
            reportMpvError('load current song', error)
            await getMpvInstance()
              ?.play()
              .catch((playError) =>
                reportMpvError('play after rejected current load', playError),
              )
          })
        }

        if (next) {
          await loadUrl(next, 'append').catch((error) => {
            reportMpvError('load next song', error)
          })
        }

        if (pause) {
          await getMpvInstance()?.pause()
        } else if (pause === false) {
          await getMpvInstance()?.play()
        }
      } catch (error) {
        reportMpvError('set queue', error)
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
        await loadUrl(url, 'append').catch((error) => {
          reportMpvError('set next queue item load', error)
        })
      }
    } catch (error) {
      reportMpvError('set next queue item', error)
    }
  })

  ipcMain.on(IpcChannels.MpvPlayerAutoNext, async (_event, url?: string) => {
    try {
      await getMpvInstance()?.playlistRemove(0).catch(() => undefined)

      if (url) {
        await loadUrl(url, 'append').catch((error) => {
          reportMpvError('auto next load', error)
        })
      }
    } catch (error) {
      reportMpvError('auto next', error)
    }
  })
}

app.on('before-quit', () => {
  quit().catch(() => undefined)
})
