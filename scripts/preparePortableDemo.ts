import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const releaseRoot = path.join(projectRoot, 'release')
const unpackedDir = path.join(releaseRoot, 'win-unpacked')
const demoDir = path.join(releaseRoot, 'Genproject-demo')

async function main(): Promise<void> {
  await rm(demoDir, { recursive: true, force: true })
  await mkdir(releaseRoot, { recursive: true })
  await cp(unpackedDir, demoDir, { recursive: true })
  await cp(path.join(projectRoot, 'demo-data'), path.join(demoDir, 'demo-data'), { recursive: true })
  await cp(path.join(projectRoot, 'README_ЗАПУСК.txt'), path.join(demoDir, 'README_ЗАПУСК.txt'))

  console.log(`Portable demo folder prepared: ${path.relative(projectRoot, demoDir)}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
