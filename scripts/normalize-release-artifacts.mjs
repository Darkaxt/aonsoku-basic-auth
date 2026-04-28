import { readFileSync, writeFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const version = packageJson.version
const baseName = `Aonsoku-BasicAuth-v${version}`
const x64Installer = `${baseName}-win-x64.exe`
const latestYmlPath = 'dist/latest.yml'
const latestYml = readFileSync(latestYmlPath, 'utf8')
const x64EntryMatch = latestYml.match(
  new RegExp(`- url: ${x64Installer}\\s+sha512: ([^\\s]+)`, 'm'),
)

if (!x64EntryMatch) {
  console.error(`Cannot find ${x64Installer} in ${latestYmlPath}`)
  process.exit(1)
}

const normalized = latestYml
  .replace(/^path:\s*.+$/m, `path: ${x64Installer}`)
  .replace(/^sha512:\s*.+$/m, `sha512: ${x64EntryMatch[1]}`)

if (normalized !== latestYml) {
  writeFileSync(latestYmlPath, normalized)
  console.log(`Normalized ${latestYmlPath} to ${x64Installer}.`)
} else {
  console.log(`${latestYmlPath} already points to ${x64Installer}.`)
}
