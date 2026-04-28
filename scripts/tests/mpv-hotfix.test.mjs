import assert from 'node:assert/strict'
import test from 'node:test'

const mpv = await import('../../src/utils/mpv.ts')

test('normalizeMpvBinaryPath preserves raw Windows paths', () => {
  const rawPath = String.raw`C:\Users\darka\scoop\apps\mpv-git\current\mpv.exe`

  assert.equal(mpv.normalizeMpvBinaryPath(rawPath), rawPath)
})

test('normalizeMpvBinaryPath trims matching quotes without changing separators', () => {
  const rawPath = String.raw`C:\Program Files\mpv\mpv.exe`

  assert.equal(mpv.normalizeMpvBinaryPath(`"${rawPath}"`), rawPath)
  assert.equal(mpv.normalizeMpvBinaryPath(`'${rawPath}'`), rawPath)
  assert.equal(mpv.normalizeMpvBinaryPath(`  ${rawPath}  `), rawPath)
})

test('normalizeMpvBinaryPath returns undefined for blank paths', () => {
  assert.equal(mpv.normalizeMpvBinaryPath(''), undefined)
  assert.equal(mpv.normalizeMpvBinaryPath('   '), undefined)
  assert.equal(mpv.normalizeMpvBinaryPath(undefined), undefined)
})

test('shouldFallbackForMpvFailure keeps MPV active for recoverable load failures', () => {
  assert.equal(mpv.shouldFallbackForMpvFailure('load'), false)
  assert.equal(mpv.shouldFallbackForMpvFailure('set-next'), false)
  assert.equal(mpv.shouldFallbackForMpvFailure('auto-next'), false)
})

test('shouldFallbackForMpvFailure falls back for MPV availability and process failures', () => {
  assert.equal(mpv.shouldFallbackForMpvFailure('initialize'), true)
  assert.equal(mpv.shouldFallbackForMpvFailure('restart'), true)
  assert.equal(mpv.shouldFallbackForMpvFailure('process-exit'), true)
  assert.equal(mpv.shouldFallbackForMpvFailure('process-crash'), true)
})

test('resolveMpvInstanceForCommand returns the active instance immediately', async () => {
  const activeInstance = { id: 'active' }
  const pendingInstance = Promise.resolve({ id: 'pending' })

  assert.equal(
    await mpv.resolveMpvInstanceForCommand(activeInstance, pendingInstance),
    activeInstance,
  )
})

test('resolveMpvInstanceForCommand waits for pending startup before queue commands', async () => {
  const pendingInstance = Promise.resolve({ id: 'pending' })

  assert.deepEqual(
    await mpv.resolveMpvInstanceForCommand(null, pendingInstance),
    { id: 'pending' },
  )
})

test('resolveMpvInstanceForCommand returns null when MPV has not started', async () => {
  assert.equal(await mpv.resolveMpvInstanceForCommand(null, null), null)
})

test('describeMpvLoadForLog redacts URL credentials and auth headers', () => {
  const rawUrl = [
    'https://',
    'proxy',
    ':',
    'secret',
    '@example.test/rest/stream.view?id=1&u=demo&p=secret&t=token&s=salt',
  ].join('')
  const authorizationHeader = `Authorization: ${'Basic'} cHJveHk6c2VjcmV0`
  const details = mpv.describeMpvLoadForLog(
    rawUrl,
    [authorizationHeader],
  )
  const serialized = JSON.stringify(details)

  assert.equal(
    details.url,
    'https://example.test/rest/stream.view?<redacted-query>',
  )
  assert.equal(details.proxyAuthorization, 'attached')
  assert.equal(serialized.includes('Basic cHJveHk6c2VjcmV0'), false)
  assert.equal(serialized.includes('proxy:secret'), false)
  assert.equal(serialized.includes('demo'), false)
  assert.equal(serialized.includes('token'), false)
})

test('describeMpvLoadForLog records absent proxy authorization without secrets', () => {
  const details = mpv.describeMpvLoadForLog(
    'https://example.test/rest/stream.view?id=1',
  )

  assert.deepEqual(details, {
    proxyAuthorization: 'absent',
    url: 'https://example.test/rest/stream.view?<redacted-query>',
  })
})

test('createMpvReplayGainProperties disables native ReplayGain when disabled', () => {
  assert.deepEqual(
    mpv.createMpvReplayGainProperties({
      defaultGain: -6,
      enabled: false,
      preAmp: 2,
      type: 'album',
    }),
    {
      replaygain: 'no',
    },
  )
})

test('createMpvReplayGainProperties maps track ReplayGain settings to MPV properties', () => {
  assert.deepEqual(
    mpv.createMpvReplayGainProperties({
      defaultGain: -5,
      enabled: true,
      preAmp: 1.5,
      type: 'track',
    }),
    {
      replaygain: 'track',
      'replaygain-clip': 'yes',
      'replaygain-fallback': -5,
      'replaygain-preamp': 1.5,
    },
  )
})

test('createMpvReplayGainProperties maps album ReplayGain settings to MPV properties', () => {
  assert.equal(
    mpv.createMpvReplayGainProperties({
      defaultGain: -7,
      enabled: true,
      preAmp: 0,
      type: 'album',
    }).replaygain,
    'album',
  )
})
