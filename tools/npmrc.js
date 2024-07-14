import fs from 'fs'
// 创建.npmrc
fs.writeFileSync('.npmrc', `@icqqjs:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}`, 'utf8')
