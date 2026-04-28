import assert from 'node:assert/strict'
import test from 'node:test'

const audioEngine = await import('../../src/utils/audio-engine.ts')

test('resolveAudioEngine defaults desktop song playback to MPV', () => {
  assert.equal(
    audioEngine.resolveAudioEngine({
      isDesktop: true,
    }),
    'mpv',
  )
})

test('resolveAudioEngine forces web playback outside desktop', () => {
  assert.equal(
    audioEngine.resolveAudioEngine({
      configuredEngine: 'mpv',
      isDesktop: false,
    }),
    'web',
  )
})

test('resolveAudioEngine falls back to web when MPV failed in the current session', () => {
  assert.equal(
    audioEngine.resolveAudioEngine({
      configuredEngine: 'mpv',
      isDesktop: true,
      mpvFallback: true,
    }),
    'web',
  )
})

test('shouldShowMpvBinaryPath only shows the MPV path for desktop MPV playback', () => {
  assert.equal(
    audioEngine.shouldShowMpvBinaryPath({
      isDesktop: true,
      isMpvOnPath: false,
      selectedEngine: 'mpv',
    }),
    true,
  )

  assert.equal(
    audioEngine.shouldShowMpvBinaryPath({
      isDesktop: true,
      isMpvOnPath: true,
      selectedEngine: 'mpv',
    }),
    false,
  )

  assert.equal(
    audioEngine.shouldShowMpvBinaryPath({
      isDesktop: true,
      isMpvOnPath: false,
      selectedEngine: 'web',
    }),
    false,
  )

  assert.equal(
    audioEngine.shouldShowMpvBinaryPath({
      isDesktop: false,
      isMpvOnPath: false,
      selectedEngine: 'mpv',
    }),
    false,
  )
})
