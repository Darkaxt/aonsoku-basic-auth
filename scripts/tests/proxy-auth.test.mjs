import assert from 'node:assert/strict'
import test from 'node:test'

const proxyAuth = await import('../../src/utils/proxy-auth.ts')

test('sanitizeServerUrl strips URL credentials and preserves the server URL', () => {
  const result = proxyAuth.sanitizeServerUrl(
    'https://proxy-user:p%40ss@example.test/music/',
  )

  assert.deepEqual(result, {
    proxyPassword: 'p@ss',
    proxyUsername: 'proxy-user',
    url: 'https://example.test/music',
  })
})

test('createBasicAuthorizationHeader encodes UTF-8 credentials', () => {
  const username = 'björn'
  const password = 'påss'

  assert.equal(
    proxyAuth.createBasicAuthorizationHeader(username, password),
    `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`,
  )
})

test('getProxyAuthOrigins returns unique configured server origins only', () => {
  const origins = proxyAuth.getProxyAuthOrigins({
    proxyAuth: {
      enabled: true,
      type: 'basic',
      username: 'proxy-user',
    },
    url: 'https://proxy.example.test/music',
  })

  assert.deepEqual(origins, ['https://proxy.example.test'])
})

test('createProxyAuthHeaderForRequest skips disabled or incomplete proxy auth', () => {
  assert.equal(
    proxyAuth.createProxyAuthHeaderForRequest(
      'https://proxy.example.test/rest/ping.view',
      {},
      {
        enabled: false,
        origins: ['https://proxy.example.test'],
        password: 'proxy-pass',
        username: 'proxy-user',
      },
    ),
    undefined,
  )

  assert.equal(
    proxyAuth.createProxyAuthHeaderForRequest(
      'https://proxy.example.test/rest/ping.view',
      {},
      {
        enabled: true,
        origins: ['https://proxy.example.test'],
        username: 'proxy-user',
      },
    ),
    undefined,
  )
})

test('createProxyAuthHeaderForRequest only matches configured origins', () => {
  assert.equal(
    proxyAuth.createProxyAuthHeaderForRequest(
      'https://other.example.test/rest/ping.view',
      {},
      {
        enabled: true,
        origins: ['https://proxy.example.test'],
        password: 'proxy-pass',
        username: 'proxy-user',
      },
    ),
    undefined,
  )
})

test('createProxyAuthHeaderForRequest does not overwrite existing Authorization headers', () => {
  assert.equal(
    proxyAuth.createProxyAuthHeaderForRequest(
      'https://proxy.example.test/rest/ping.view',
      { authorization: 'Bearer token' },
      {
        enabled: true,
        origins: ['https://proxy.example.test'],
        password: 'proxy-pass',
        username: 'proxy-user',
      },
    ),
    undefined,
  )
})

test('redactProxyAuthFromText redacts Basic headers and URL credentials', () => {
  assert.equal(
    proxyAuth.redactProxyAuthFromText(
      'Authorization: Basic cHJveHk6c2VjcmV0 https://proxy:secret@example.test/rest',
    ),
    'Authorization: Basic <redacted> https://<proxy-auth>@example.test/rest',
  )
})
