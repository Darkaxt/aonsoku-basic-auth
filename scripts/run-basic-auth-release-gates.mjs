import { spawnSync } from 'node:child_process'

const full = process.argv.includes('--full')

const commands = [
  [
    'node',
    [
      '--test',
      'scripts/tests/proxy-auth.test.mjs',
      'scripts/tests/audio-engine.test.mjs',
      'scripts/tests/mpv-hotfix.test.mjs',
    ],
  ],
  ['corepack', ['pnpm', 'run', 'build']],
  ['corepack', ['pnpm', 'run', 'electron:build']],
  ['corepack', ['pnpm', 'run', 'check:electron-runtime-deps']],
  ['corepack', ['pnpm', 'run', 'lint']],
  ['node', ['scripts/check-basic-auth-secrets.mjs']],
]

if (full) {
  commands.push(['node', ['scripts/basic-auth-smoke.mjs']])
  commands.push(['corepack', ['pnpm', 'run', 'build:win']])
  commands.push(['corepack', ['pnpm', 'run', 'normalize:release-artifacts']])
  commands.push(['corepack', ['pnpm', 'run', 'check:release-artifacts']])
}

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`)

  const result =
    process.platform === 'win32' && command === 'corepack'
      ? spawnSync(`corepack ${args.join(' ')}`, {
          shell: true,
          stdio: 'inherit',
        })
      : spawnSync(command, args, {
          stdio: 'inherit',
        })

  if (result.error) {
    console.error(result.error)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
