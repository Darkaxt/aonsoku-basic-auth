import { useEffect } from 'react'
import { useAppData } from '@/store/app.store'
import { syncProxyAuthDataToDesktop } from '@/utils/proxy-auth-sync'

export function ProxyAuthObserver() {
  const { proxyAuth, url } = useAppData()
  const proxyAuthEnabled = proxyAuth?.enabled ?? false
  const proxyAuthUsername = proxyAuth?.username ?? ''

  useEffect(() => {
    syncProxyAuthDataToDesktop({
      proxyAuth: proxyAuthEnabled
        ? {
            enabled: proxyAuthEnabled,
            type: 'basic',
            username: proxyAuthUsername,
          }
        : undefined,
      url,
    }).catch(() => undefined)
  }, [proxyAuthEnabled, proxyAuthUsername, url])

  return null
}
