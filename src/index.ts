import { getApkInfoList } from './imports/device'
import { main } from './core/init'
import { logger, common } from 'node-karin'
import { basename, dirPath } from '@/imports'
import path from 'path'

const pkg = common.readJson(dirPath + '/package.json')
const Path = path.join(process.cwd(), 'node_modules', 'icqq', 'lib', 'core', 'device.js')
try {
  (await import(Path)).default.getApkInfoList = getApkInfoList
} catch (e) { }
logger.info(`${logger.violet(`[插件:${pkg.version}]`)} ${logger.green(basename)} 初始化完成~`)

main()
export * from 'icqq'
