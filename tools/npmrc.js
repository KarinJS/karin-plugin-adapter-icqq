import fs from 'fs'
// 创建.npmrc
fs.writeFileSync('.npmrc', `//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
@icqqjs:registry=https://npm.pkg.github.com`, 'utf8')
