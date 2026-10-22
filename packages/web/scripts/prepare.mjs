import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '..')
const outDir = path.resolve(webRoot, '../core/web')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true })

fs.copyFileSync(path.join(webRoot, 'index.html'), path.join(outDir, 'index.html'))

console.log(`[web] 静态文件已准备: ${outDir}`)
