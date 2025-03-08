import fs from 'fs'
const file = './package.json'
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))

pkg.dependencies.icqq = '*'

fs.writeFileSync(file, JSON.stringify(pkg, null, 2), 'utf8')
