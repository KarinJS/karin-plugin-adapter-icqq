import './core/init'
import { logger, common } from 'node-karin'
import { basename, dirPath } from '@/imports'

const pkg = common.readJson(dirPath + '/package.json')

logger.info(`${logger.violet(`[插件:${pkg.version}]`)} ${logger.green(basename)} 初始化完成~`)

export * from 'icqq'
