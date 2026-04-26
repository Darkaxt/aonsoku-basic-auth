import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { toast } from 'react-toastify'
import { z } from 'zod'
import { queryServerInfo } from '@/api/queryServerInfo'
import { LangToggle } from '@/app/components/login/lang-toggle'
import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form'
import { Input } from '@/app/components/ui/input'
import { Password } from '@/app/components/ui/password'
import { Switch } from '@/app/components/ui/switch'
import { ROUTES } from '@/routes/routesList'
import { useAppActions, useAppData } from '@/store/app.store'
import {
  createBasicAuthorizationHeader,
  sanitizeServerUrl,
} from '@/utils/proxy-auth'
import { syncProxyAuthToDesktop } from '@/utils/proxy-auth-sync'
import { isDesktop } from '@/utils/desktop'
import { removeSlashFromUrl } from '@/utils/removeSlashFromUrl'

const loginSchema = z.object({
  url: z
    .string()
    .url({ message: 'login.form.validations.url' })
    .refine((value) => /^https?:\/\//.test(value), {
      message: 'login.form.validations.protocol',
    }),
  username: z
    .string({ required_error: 'login.form.validations.username' }),
  password: z
    .string({ required_error: 'login.form.validations.password' }),
  proxyAuthEnabled: z.boolean(),
  proxyAuthUsername: z.string().optional(),
  proxyAuthPassword: z.string().optional(),
})

type FormData = z.infer<typeof loginSchema>

const defaultUrl = isDesktop() ? 'http://' : 'https://'
const url = window.SERVER_URL || defaultUrl
const urlIsValid = url !== defaultUrl

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [serverIsIncompatible, setServerIsIncompatible] = useState(false)
  const { saveConfig } = useAppActions()
  const { hideServer } = useAppData()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const shouldHideUrlInput = urlIsValid && hideServer

  const form = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    values: {
      url,
      username: '',
      password: '',
      proxyAuthEnabled: false,
      proxyAuthPassword: '',
      proxyAuthUsername: '',
    },
  })

  async function onSubmit(data: FormData, forceCompatible?: boolean) {
    setLoading(true)

    const sanitizedUrl = sanitizeServerUrl(data.url)
    const normalizedUrl = removeSlashFromUrl(sanitizedUrl.url)
    const proxyAuthEnabled =
      data.proxyAuthEnabled ||
      Boolean(sanitizedUrl.proxyUsername || sanitizedUrl.proxyPassword)
    const proxyAuthUsername =
      data.proxyAuthUsername?.trim() || sanitizedUrl.proxyUsername || ''
    const proxyAuthPassword =
      data.proxyAuthPassword || sanitizedUrl.proxyPassword || ''
    const proxyAuth =
      proxyAuthEnabled && proxyAuthUsername
        ? {
            enabled: true,
            type: 'basic' as const,
            username: proxyAuthUsername,
          }
        : undefined

    if (proxyAuthEnabled && (!proxyAuthUsername || !proxyAuthPassword)) {
      if (!proxyAuthUsername) {
        form.setError('proxyAuthUsername', {
          message: 'login.form.validations.proxyUsername',
        })
      }

      if (!proxyAuthPassword) {
        form.setError('proxyAuthPassword', {
          message: 'login.form.validations.proxyPassword',
        })
      }

      setLoading(false)
      return
    }

    if (proxyAuth && !isDesktop()) {
      setLoading(false)
      toast.error(t('toast.server.proxyAuthUnavailable'))
      return
    }

    const proxyAuthHeader =
      proxyAuth && proxyAuthPassword
        ? createBasicAuthorizationHeader(proxyAuth.username, proxyAuthPassword)
        : undefined
    const proxyAuthHeaders = proxyAuthHeader
      ? { Authorization: proxyAuthHeader }
      : undefined

    // Check if server is compatible
    const serverInfo = await queryServerInfo(normalizedUrl, proxyAuthHeaders)

    // If server version is lower than 1.15.0
    if (serverInfo.protocolVersionNumber < 1150 && forceCompatible !== true) {
      setServerIsIncompatible(true)
      setLoading(false)
      return
    } else {
      setServerIsIncompatible(false)
    }

    let proxySecretSaved = false

    if (proxyAuth && proxyAuthPassword) {
      proxySecretSaved = await window.api.setProxyAuthSecret(proxyAuthPassword)

      if (!proxySecretSaved) {
        setLoading(false)
        toast.error(t('toast.server.proxyAuthSecretError'))
        return
      }
    }

    const status = await saveConfig({
      ...data,
      proxyAuth,
      url: normalizedUrl,
    }, { proxyAuthHeader })

    if (status) {
      await syncProxyAuthToDesktop()
      await queryClient.invalidateQueries()
      toast.success(t('toast.server.success'))
      navigate(ROUTES.LIBRARY.HOME, { replace: true })
    } else {
      if (proxySecretSaved) {
        window.api.removeProxyAuthSecret()
      }

      setLoading(false)
      toast.error(t('toast.server.error'))
    }
  }

  return (
    <>
      <Card className="w-[450px] bg-background-foreground">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => onSubmit(data))}>
            <CardHeader className="flex">
              <CardTitle className="flex flex-row justify-between items-center">
                {t('login.form.server')}
                <div className="flex gap-2 items-center">
                  <LangToggle />
                </div>
              </CardTitle>
              <CardDescription>{t('login.form.description')}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-2">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem className={clsx(shouldHideUrlInput && 'hidden')}>
                    <FormLabel className="required">
                      {t('login.form.url')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="url"
                        type="text"
                        placeholder={t('login.form.urlDescription')}
                        autoCorrect="false"
                        autoCapitalize="false"
                        spellCheck="false"
                      />
                    </FormControl>
                    <FormDescription>
                      {t('login.form.urlDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className={clsx(shouldHideUrlInput && '!mt-0')}>
                    <FormLabel className="required">
                      {t('login.form.username')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        id="username"
                        type="text"
                        placeholder={t('login.form.usernamePlaceholder')}
                        autoCorrect="false"
                        autoCapitalize="false"
                        spellCheck="false"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="required">
                      {t('login.form.password')}
                    </FormLabel>
                    <FormControl>
                      <Password {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-md border p-3 space-y-3">
                <FormField
                  control={form.control}
                  name="proxyAuthEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-3">
                      <div className="space-y-1">
                        <FormLabel>
                          {t('login.form.proxyAuth.enabled')}
                        </FormLabel>
                        <FormDescription>
                          {t('login.form.proxyAuth.description')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('proxyAuthEnabled') && (
                  <>
                    <FormField
                      control={form.control}
                      name="proxyAuthUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('login.form.proxyAuth.username')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ''}
                              id="proxyAuthUsername"
                              type="text"
                              autoCorrect="false"
                              autoCapitalize="false"
                              spellCheck="false"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="proxyAuthPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t('login.form.proxyAuth.password')}
                          </FormLabel>
                          <FormControl>
                            <Password
                              {...field}
                              value={field.value ?? ''}
                              id="proxyAuthPassword"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('login.form.connecting')}
                  </>
                ) : (
                  <>{t('login.form.connect')}</>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Dialog
        open={serverIsIncompatible}
        onOpenChange={(state) => {
          setServerIsIncompatible(state)
        }}
      >
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('server.incompatible.title')}</DialogTitle>
          </DialogHeader>
          <p>{t('server.incompatible.description')}</p>
          <DialogFooter>
            <Button onClick={form.handleSubmit((data) => onSubmit(data, true))}>
              {t('server.incompatible.skip')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
