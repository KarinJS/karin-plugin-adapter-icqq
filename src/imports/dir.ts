import path from 'path'
import { fileURLToPath } from 'url'

/** 当前文件的绝对路径 */
const filePath = fileURLToPath(import.meta.url).replace(/\\/g, '/')
/** 插件包的目录路径 */
const dirname = path.resolve(filePath, '../../../')
/** 插件包的名称 */
const basename = path.basename(dirname)
/** 插件包相对路径 */
const dirPath = './plugins/' + basename

export { dirPath, basename }
