import fs from 'fs'
const file = './package.json'
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))

pkg.dependencies.icqq = 'latest'
delete pkg.dependencies['@icqqjs/icqq']
pkg.name = 'karin-plugin-adapter-icqq-old'

pkg.devDependencies = {
  '@types/express': 'latest',
  '@types/lodash': 'latest',
  '@types/node': 'latest',
  '@types/node-schedule': 'latest',
  '@types/ws': 'latest',
  eslint: 'latest',
  neostandard: 'latest',
  'node-karin': 'latest',
  'tsc-alias': 'latest',
  tsx: 'latest',
  typescript: 'latest',
}

fs.writeFileSync(file, JSON.stringify(pkg, null, 2), 'utf8')

// 修改 src/code/index.ts 中的 import @icqqjs/icqq 为 import icqq
const ts = './lib/core/index.js'
const code = fs.readFileSync(ts, 'utf8')
fs.writeFileSync(ts, code.replace('@icqqjs/icqq', 'icqq'), 'utf8')

const ts1 = './lib/index.js'
const code1 = fs.readFileSync(ts1, 'utf8')
fs.writeFileSync(ts1, code1.replace('@icqqjs/icqq', 'icqq'), 'utf8')
