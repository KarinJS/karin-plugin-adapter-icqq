import fs from 'fs'
const file = './package.json'
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))

pkg.dependencies.icqq = 'latest'
delete pkg.dependencies['@icqqjs/icqq']
pkg.name = '@karinjs/adapter-icqq-old'

fs.writeFileSync(file, JSON.stringify(pkg, null, 2), 'utf8')

// 修改 src/code/index.ts 中的 import @icqqjs/icqq 为 import icqq
const ts = './lib/core/index.js'
const code = fs.readFileSync(ts, 'utf8')
fs.writeFileSync(ts, code.replace('@icqqjs/icqq', 'icqq'), 'utf8')

const ts1 = './lib/index.js'
const code1 = fs.readFileSync(ts1, 'utf8')
fs.writeFileSync(ts1, code1.replace('@icqqjs/icqq', 'icqq'), 'utf8')
