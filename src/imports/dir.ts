import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/** 当前文件的绝对路径 */
const filePath = fileURLToPath(import.meta.url).replace(/\\/g, '/')
/** 插件包的目录绝对路径 */
let dirPath = path.resolve(filePath, '../../../')

if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
  dirPath = path.resolve(filePath, '../../')
}
/** 插件包的名称 */
const basename = JSON.parse(fs.readFileSync(`${dirPath}/package.json`, 'utf-8')).name

export { dirPath, basename }
