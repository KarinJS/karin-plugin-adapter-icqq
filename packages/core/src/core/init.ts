import { logger } from 'node-karin'
import { Config } from '@/config'
import { startAccount } from './runtime'
import { getIcqqVersion } from './version'

/** 读取配置并启动所有启用的账号 */
export function main (): void {
  const config = Config.getConfig
  const version = getIcqqVersion()

  for (const account of config.list) {
    if (account.enable === false) {
      logger.debug(`[ICQQ Adapter] 账号 ${account.qq} 已停用，跳过启动`)
      continue
    }
    startAccount(account, version, config.sign_api_addr)
  }
}
