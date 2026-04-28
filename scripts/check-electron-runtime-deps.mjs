import { readFileSync } from 'node:fs'

const mainBundlePath = 'out/main/index.js'
const mainBundle = readFileSync(mainBundlePath, 'utf8')

const forbiddenRuntimeImports = [
  {
    name: 'node-mpv',
    pattern: /(?:from\s*["']node-mpv["']|import\(["']node-mpv["']\)|require\(["']node-mpv["']\))/,
    reason:
      'node-mpv must be bundled into the Electron main output because packaged app.asar does not include node_modules.',
  },
]

const failures = forbiddenRuntimeImports.filter(({ pattern }) => pattern.test(mainBundle))

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Forbidden runtime import found: ${failure.name}`)
    console.error(failure.reason)
  }

  process.exitCode = 1
} else {
  console.log('Electron main runtime dependency check passed.')
}
