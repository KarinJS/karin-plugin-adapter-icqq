import './core/init.js'
import { logger, common } from 'node-karin'
import { basename, dirPath } from './imports/index.js'
const pkg = common.readJson(dirPath + '/package.json')
logger.info(`${logger.violet(`[插件:${pkg.version}]`)} ${logger.green(basename)} 初始化完成~`)
