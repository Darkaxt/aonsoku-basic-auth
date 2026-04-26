import { ipcMain, safeStorage, Session } from 'electron'
import { IpcChannels } from '../../preload/types'
import type { ProxyAuthSyncPayload } from '../../preload/types'
import {
  createProxyAuthHeaderForRequest,
  PROXY_BASIC_AUTH_SECRET_KEY,
  ProxyAuthRequestConfig,
} from '../../../src/utils/proxy-auth'
import { AonsokuStore } from './store'

type ProxyAuthStorePayload = {
  secrets: Record<string, string>
}

const proxyAuthStore = new AonsokuStore<ProxyAuthStorePayload>({
  name: 'proxy-auth',
  defaults: {
    secrets: {},
  },
})

const installedSessions = new WeakSet<Session>()

let activeProxyAuth: ProxyAuthRequestConfig = {
  enabled: false,
  origins: [],
  username: '',
}

function getProxyAuthPassword(): string | undefined {
  if (!safeStorage.isEncryptionAvailable()) return undefined

  const encrypted = proxyAuthStore.get('secrets')[PROXY_BASIC_AUTH_SECRET_KEY]

  if (!encrypted) return undefined

  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'hex'))
  } catch {
    return undefined
  }
}

function saveProxyAuthPassword(password: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false

  const secrets = proxyAuthStore.get('secrets')
  secrets[PROXY_BASIC_AUTH_SECRET_KEY] = safeStorage
    .encryptString(password)
    .toString('hex')

  proxyAuthStore.set('secrets', secrets)

  return true
}

function removeProxyAuthPassword() {
  const secrets = proxyAuthStore.get('secrets')
  delete secrets[PROXY_BASIC_AUTH_SECRET_KEY]
  proxyAuthStore.set('secrets', secrets)

  activeProxyAuth = {
    ...activeProxyAuth,
    password: undefined,
  }
}

function syncProxyAuth(config: ProxyAuthSyncPayload) {
  activeProxyAuth = {
    enabled: Boolean(config.enabled),
    origins: Array.isArray(config.origins) ? config.origins : [],
    password: getProxyAuthPassword(),
    username: config.username ?? '',
  }
}

export function setupProxyAuthIpc() {
  ipcMain.removeHandler(IpcChannels.SetProxyAuthSecret)
  ipcMain.handle(IpcChannels.SetProxyAuthSecret, (_event, password: string) => {
    return saveProxyAuthPassword(password)
  })

  ipcMain.removeAllListeners(IpcChannels.RemoveProxyAuthSecret)
  ipcMain.on(IpcChannels.RemoveProxyAuthSecret, () => {
    removeProxyAuthPassword()
  })

  ipcMain.removeHandler(IpcChannels.SyncProxyAuth)
  ipcMain.handle(IpcChannels.SyncProxyAuth, (_event, config: ProxyAuthSyncPayload) => {
    syncProxyAuth(config)
  })
}

export function installProxyAuthInterceptor(session: Session) {
  if (installedSessions.has(session)) return

  installedSessions.add(session)

  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const header = createProxyAuthHeaderForRequest(
      details.url,
      details.requestHeaders,
      activeProxyAuth,
    )

    if (!header) {
      callback({ requestHeaders: details.requestHeaders })
      return
    }

    callback({
      requestHeaders: {
        ...details.requestHeaders,
        Authorization: header,
      },
    })
  })
}
