import { useAppStore } from '@/store/app.store'
import {
  getProxyAuthOrigins,
  ProxyBasicAuthConfig,
} from '@/utils/proxy-auth'
import { isDesktop } from './desktop'

type ProxyAuthSyncSource = {
  proxyAuth?: ProxyBasicAuthConfig
  url?: string
}

export async function syncProxyAuthDataToDesktop({
  proxyAuth,
  url,
}: ProxyAuthSyncSource) {
  if (!isDesktop()) return

  await window.api.syncProxyAuth({
    enabled: Boolean(proxyAuth?.enabled),
    origins: getProxyAuthOrigins({ proxyAuth, url }),
    username: proxyAuth?.username ?? '',
  })
}

export async function syncProxyAuthToDesktop() {
  await syncProxyAuthDataToDesktop(useAppStore.getState().data)
}
