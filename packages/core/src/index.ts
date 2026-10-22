import { logger } from 'node-karin'
import { Root } from './common'
import { main } from './core/init'
import { initServer } from './server'

initServer()
main()

logger.info(`${logger.violet(`[插件:${Root.pluginVersion}]`)} ${logger.green(Root.pluginName)} 初始化完成~`)

export * from 'icqq'
