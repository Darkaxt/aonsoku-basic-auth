import { electronAPI } from '@electron-toolkit/preload'
import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron'
import { IAonsokuAPI, IpcChannels, PlayerStateListenerActions } from './types'

function createListener<T>(
  channel: IpcChannels,
  callback: (payload: T) => void,
) {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload)

  ipcRenderer.on(channel, listener)

  return () => ipcRenderer.removeListener(channel, listener)
}

// Custom APIs for renderer
const api: IAonsokuAPI = {
  enterFullScreen: () => ipcRenderer.send(IpcChannels.ToggleFullscreen, true),
  exitFullScreen: () => ipcRenderer.send(IpcChannels.ToggleFullscreen, false),
  isFullScreen: () => ipcRenderer.invoke(IpcChannels.IsFullScreen),
  fullscreenStatusListener: (func) => {
    ipcRenderer.on(IpcChannels.FullscreenStatus, (_, status: boolean) =>
      func(status),
    )
  },
  removeFullscreenStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.FullscreenStatus)
  },
  isMaximized: () => ipcRenderer.invoke(IpcChannels.IsMaximized),
  maximizedStatusListener: (func) => {
    ipcRenderer.on(IpcChannels.MaximizedStatus, (_, status: boolean) =>
      func(status),
    )
  },
  removeMaximizedStatusListener: () => {
    ipcRenderer.removeAllListeners(IpcChannels.MaximizedStatus)
  },
  toggleMaximize: (isMaximized) =>
    ipcRenderer.send(IpcChannels.ToggleMaximize, isMaximized),
  toggleMinimize: () => ipcRenderer.send(IpcChannels.ToggleMinimize),
  closeWindow: () => ipcRenderer.send(IpcChannels.CloseWindow),
  setTitleBarOverlayColors: (color) =>
    ipcRenderer.send(IpcChannels.ThemeChanged, color),
  setNativeTheme: (isDark) =>
    ipcRenderer.send(IpcChannels.UpdateNativeTheme, isDark),
  downloadFile: (payload) =>
    ipcRenderer.send(IpcChannels.HandleDownloads, payload),
  downloadCompletedListener: (func) => {
    ipcRenderer.once(IpcChannels.DownloadCompleted, (_, fileId: string) =>
      func(fileId),
    )
  },
  downloadFailedListener: (func) => {
    ipcRenderer.once(IpcChannels.DownloadFailed, (_, fileId: string) =>
      func(fileId),
    )
  },
  updatePlayerState: (payload) => {
    ipcRenderer.send(IpcChannels.UpdatePlayerState, payload)
  },
  playerStateListener: (func) => {
    ipcRenderer.on(
      IpcChannels.PlayerStateListener,
      (_, state: PlayerStateListenerActions) => func(state),
    )
  },
  setDiscordRpcActivity: (payload) => {
    ipcRenderer.send(IpcChannels.SetDiscordRpcActivity, payload)
  },
  clearDiscordRpcActivity: () => {
    ipcRenderer.send(IpcChannels.ClearDiscordRpcActivity)
  },
  saveAppSettings: (payload) => {
    ipcRenderer.send(IpcChannels.SaveAppSettings, payload)
  },
  setProxyAuthSecret: (password) =>
    ipcRenderer.invoke(IpcChannels.SetProxyAuthSecret, password),
  removeProxyAuthSecret: () =>
    ipcRenderer.send(IpcChannels.RemoveProxyAuthSecret),
  syncProxyAuth: (payload) =>
    ipcRenderer.invoke(IpcChannels.SyncProxyAuth, payload),
  mpvPlayer: {
    initialize: (payload) =>
      ipcRenderer.invoke(IpcChannels.MpvPlayerInitialize, payload),
    restart: (payload) =>
      ipcRenderer.invoke(IpcChannels.MpvPlayerRestart, payload),
    isRunning: () => ipcRenderer.invoke(IpcChannels.MpvPlayerIsRunning),
    isOnPath: () => ipcRenderer.invoke(IpcChannels.MpvPlayerIsOnPath),
    cleanup: () => ipcRenderer.send(IpcChannels.MpvPlayerCleanup),
    setProperties: (payload) =>
      ipcRenderer.send(IpcChannels.MpvPlayerSetProperties, payload),
    quit: () => ipcRenderer.send(IpcChannels.MpvPlayerQuit),
    play: () => ipcRenderer.send(IpcChannels.MpvPlayerPlay),
    pause: () => ipcRenderer.send(IpcChannels.MpvPlayerPause),
    stop: () => ipcRenderer.send(IpcChannels.MpvPlayerStop),
    seek: (seconds) => ipcRenderer.send(IpcChannels.MpvPlayerSeek, seconds),
    seekTo: (seconds) =>
      ipcRenderer.send(IpcChannels.MpvPlayerSeekTo, seconds),
    volume: (value) => ipcRenderer.send(IpcChannels.MpvPlayerVolume, value),
    mute: (muted) => ipcRenderer.send(IpcChannels.MpvPlayerMute, muted),
    getCurrentTime: () =>
      ipcRenderer.invoke(IpcChannels.MpvPlayerGetCurrentTime),
    setQueue: (current, next, pause) =>
      ipcRenderer.send(IpcChannels.MpvPlayerSetQueue, current, next, pause),
    setQueueNext: (url) =>
      ipcRenderer.send(IpcChannels.MpvPlayerSetQueueNext, url),
    autoNext: (url) => ipcRenderer.send(IpcChannels.MpvPlayerAutoNext, url),
  },
  mpvPlayerListener: {
    onAutoNext: (callback) =>
      createListener<void>(IpcChannels.MpvPlayerAutoNext, callback),
    onCurrentTime: (callback) =>
      createListener<number>(IpcChannels.MpvPlayerCurrentTime, callback),
    onPlay: (callback) =>
      createListener<void>(IpcChannels.MpvPlayerPlay, callback),
    onPause: (callback) =>
      createListener<void>(IpcChannels.MpvPlayerPause, callback),
    onStop: (callback) =>
      createListener<void>(IpcChannels.MpvPlayerStop, callback),
    onFallback: (callback) =>
      createListener<boolean>(IpcChannels.MpvPlayerFallback, callback),
    onError: (callback) =>
      createListener<string>(IpcChannels.MpvPlayerError, callback),
  },
  checkForUpdates: () => ipcRenderer.invoke(IpcChannels.CheckForUpdates),
  downloadUpdate: () => ipcRenderer.send(IpcChannels.DownloadUpdate),
  quitAndInstall: () => ipcRenderer.send(IpcChannels.QuitAndInstall),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on(IpcChannels.UpdateAvailable, (_, info) => callback(info))
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on(IpcChannels.UpdateNotAvailable, () => callback())
  },
  onUpdateError: (callback) => {
    ipcRenderer.on(IpcChannels.UpdateError, (_, error) => callback(error))
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on(IpcChannels.DownloadProgress, (_, progress) =>
      callback(progress),
    )
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on(IpcChannels.UpdateDownloaded, (_, info) => callback(info))
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
