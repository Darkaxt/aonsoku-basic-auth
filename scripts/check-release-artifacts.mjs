import { existsSync, readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const version = packageJson.version
const baseName = `Aonsoku-BasicAuth-v${version}`

const expectedAssets = [
  `${baseName}-win-x64.exe`,
  `${baseName}-win-x64.exe.blockmap`,
  `${baseName}-win-arm64.exe`,
  `${baseName}-win-arm64.exe.blockmap`,
  `${baseName}-win.exe`,
  `${baseName}-win.exe.blockmap`,
  'latest.yml',
]
const expectedLatestYmlUrls = [
  `${baseName}-win-x64.exe`,
  `${baseName}-win-arm64.exe`,
  `${baseName}-win.exe`,
]

const missingAssets = expectedAssets.filter((asset) => !existsSync(`dist/${asset}`))

if (missingAssets.length > 0) {
  console.error(`Missing release assets: ${missingAssets.join(', ')}`)
  process.exit(1)
}

const latestYml = readFileSync('dist/latest.yml', 'utf8')
const expectedPath = `${baseName}-win-x64.exe`
const pathMatch = latestYml.match(/^path:\s*(.+)$/m)
const topLevelShaMatch = latestYml.match(/^sha512:\s*(.+)$/m)
const x64EntryMatch = latestYml.match(
  new RegExp(`- url: ${expectedPath}\\s+sha512: ([^\\s]+)`, 'm'),
)
const assetUrls = [...latestYml.matchAll(/^\s+- url:\s*(.+)$/gm)].map(
  ([, url]) => url,
)

if (!latestYml.includes(`version: ${version}`)) {
  console.error(`latest.yml does not declare version ${version}`)
  process.exit(1)
}

if (pathMatch?.[1] !== expectedPath) {
  console.error(`latest.yml path must be ${expectedPath}, got ${pathMatch?.[1]}`)
  process.exit(1)
}

if (!topLevelShaMatch || !x64EntryMatch || topLevelShaMatch[1] !== x64EntryMatch[1]) {
  console.error('latest.yml top-level sha512 must match the x64 installer entry')
  process.exit(1)
}

for (const asset of expectedLatestYmlUrls) {
  if (!assetUrls.includes(asset)) {
    console.error(`latest.yml is missing asset URL ${asset}`)
    process.exit(1)
  }
}

for (const url of assetUrls) {
  if (/\s/.test(url)) {
    console.error(`latest.yml contains whitespace in asset URL ${url}`)
    process.exit(1)
  }
}

console.log('Release artifact check passed.')
