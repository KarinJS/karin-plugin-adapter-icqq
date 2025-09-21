import './core/init'
import { logger } from 'node-karin'
import { Root } from './imports'

logger.info(`${logger.violet(`[插件:${Root.pluginVersion}]`)} ${logger.green(Root.pluginName)} 初始化完成~`)

export * from 'icqq'
