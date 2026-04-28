import {
  type ProgressInfo,
  type UpdateCheckResult,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from 'electron-updater'
import { RpcPayload } from '../main/core/discordRpc'
import { IDownloadPayload } from '../main/core/downloads'
import { ISettingPayload } from '../main/core/settings'

export enum IpcChannels {
  FullscreenStatus = 'fullscreen-status',
  ToggleFullscreen = 'toggle-fullscreen',
  IsFullScreen = 'is-fullscreen',
  IsMaximized = 'is-maximized',
  MaximizedStatus = 'maximized-status',
  ToggleMaximize = 'toggle-maximize',
  ToggleMinimize = 'toggle-minimize',
  CloseWindow = 'close-window',
  ThemeChanged = 'theme-changed',
  UpdateNativeTheme = 'update-native-theme',
  HandleDownloads = 'handle-downloads',
  DownloadCompleted = 'download-completed',
  DownloadFailed = 'download-failed',
  UpdatePlayerState = 'update-player-state',
  PlayerStateListener = 'player-state-listener',
  SetDiscordRpcActivity = 'set-discord-rpc-activity',
  ClearDiscordRpcActivity = 'clear-discord-rpc-activity',
  SaveAppSettings = 'save-app-settings',
  SetProxyAuthSecret = 'set-proxy-auth-secret',
  RemoveProxyAuthSecret = 'remove-proxy-auth-secret',
  SyncProxyAuth = 'sync-proxy-auth',
  MpvPlayerInitialize = 'mpv-player-initialize',
  MpvPlayerRestart = 'mpv-player-restart',
  MpvPlayerIsRunning = 'mpv-player-is-running',
  MpvPlayerIsOnPath = 'mpv-player-is-on-path',
  MpvPlayerCleanup = 'mpv-player-cleanup',
  MpvPlayerSetProperties = 'mpv-player-set-properties',
  MpvPlayerQuit = 'mpv-player-quit',
  MpvPlayerPlay = 'mpv-player-play',
  MpvPlayerPause = 'mpv-player-pause',
  MpvPlayerStop = 'mpv-player-stop',
  MpvPlayerSeek = 'mpv-player-seek',
  MpvPlayerSeekTo = 'mpv-player-seek-to',
  MpvPlayerVolume = 'mpv-player-volume',
  MpvPlayerMute = 'mpv-player-mute',
  MpvPlayerGetCurrentTime = 'mpv-player-get-current-time',
  MpvPlayerSetQueue = 'mpv-player-set-queue',
  MpvPlayerSetQueueNext = 'mpv-player-set-queue-next',
  MpvPlayerAutoNext = 'mpv-player-auto-next',
  MpvPlayerCurrentTime = 'mpv-player-current-time',
  MpvPlayerFallback = 'mpv-player-fallback',
  MpvPlayerError = 'mpv-player-error',
  CheckForUpdates = 'check-for-updates',
  DownloadUpdate = 'download-update',
  QuitAndInstall = 'quit-and-install',
  UpdateAvailable = 'update-available',
  UpdateNotAvailable = 'update-not-available',
  UpdateError = 'update-error',
  DownloadProgress = 'download-progress',
  UpdateDownloaded = 'update-downloaded',
}

export type OverlayColors = {
  color: string
  symbol: string
  bgColor: string
}

export type PlayerStatePayload = {
  isPlaying: boolean
  hasPrevious: boolean
  hasNext: boolean
  hasSonglist: boolean
}

export type PlayerStateListenerActions =
  | 'togglePlayPause'
  | 'skipBackwards'
  | 'skipForward'
  | 'toggleShuffle'
  | 'toggleRepeat'

export interface ProxyAuthSyncPayload {
  enabled: boolean
  origins: string[]
  username: string
}

export type MpvInitializePayload = {
  binaryPath?: string
  properties?: Record<string, unknown>
}

export interface IMpvPlayerAPI {
  initialize: (payload?: MpvInitializePayload) => Promise<boolean>
  restart: (payload?: MpvInitializePayload) => Promise<boolean>
  isRunning: () => Promise<boolean>
  isOnPath: () => Promise<boolean>
  cleanup: () => void
  setProperties: (payload: Record<string, unknown>) => void
  quit: () => void
  play: () => void
  pause: () => void
  stop: () => void
  seek: (seconds: number) => void
  seekTo: (seconds: number) => void
  volume: (value: number) => void
  mute: (muted: boolean) => void
  getCurrentTime: () => Promise<number | undefined>
  setQueue: (current?: string, next?: string, pause?: boolean) => void
  setQueueNext: (url?: string) => void
  autoNext: (url?: string) => void
}

export interface IMpvPlayerListenerAPI {
  onAutoNext: (callback: () => void) => () => void
  onCurrentTime: (callback: (time: number) => void) => () => void
  onPlay: (callback: () => void) => () => void
  onPause: (callback: () => void) => () => void
  onStop: (callback: () => void) => () => void
  onFallback: (callback: (enabled: boolean) => void) => () => void
  onError: (callback: (message: string) => void) => () => void
}

export interface IAonsokuAPI {
  enterFullScreen: () => void
  exitFullScreen: () => void
  isFullScreen: () => Promise<boolean>
  fullscreenStatusListener: (func: (status: boolean) => void) => void
  removeFullscreenStatusListener: () => void
  isMaximized: () => Promise<boolean>
  maximizedStatusListener: (func: (status: boolean) => void) => void
  removeMaximizedStatusListener: () => void
  toggleMaximize: (isMaximized: boolean) => void
  toggleMinimize: () => void
  closeWindow: () => void
  setTitleBarOverlayColors: (colors: OverlayColors) => void
  setNativeTheme: (isDark: boolean) => void
  downloadFile: (payload: IDownloadPayload) => void
  downloadCompletedListener: (func: (fileId: string) => void) => void
  downloadFailedListener: (func: (fileId: string) => void) => void
  updatePlayerState: (payload: PlayerStatePayload) => void
  playerStateListener: (
    func: (action: PlayerStateListenerActions) => void,
  ) => void
  setDiscordRpcActivity: (payload: RpcPayload) => void
  clearDiscordRpcActivity: () => void
  saveAppSettings: (payload: ISettingPayload) => void
  setProxyAuthSecret: (password: string) => Promise<boolean>
  removeProxyAuthSecret: () => void
  syncProxyAuth: (payload: ProxyAuthSyncPayload) => Promise<void>
  mpvPlayer: IMpvPlayerAPI
  mpvPlayerListener: IMpvPlayerListenerAPI
  checkForUpdates: () => Promise<UpdateCheckResult | null>
  downloadUpdate: () => void
  quitAndInstall: () => void
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void
  onUpdateNotAvailable: (callback: () => void) => void
  onUpdateError: (callback: (error: string) => void) => void
  onDownloadProgress: (callback: (progress: ProgressInfo) => void) => void
  onUpdateDownloaded: (callback: (info: UpdateDownloadedEvent) => void) => void
}
