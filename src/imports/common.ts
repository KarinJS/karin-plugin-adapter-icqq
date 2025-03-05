import karin, { config, logger } from 'node-karin'
import lodash from 'node-karin/lodash'
import moment from 'node-karin/moment'

class Common {
  /**
   * 生成随机数
   * @param min - 最小值
   * @param max - 最大值
   * @returns
   */
  random (min: number, max: number) {
    return lodash.random(min, max)
  }

  /**
   * 睡眠函数
   * @param ms - 毫秒
   */
  sleep (ms: number | undefined) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 使用moment返回时间
   * @param format - 格式
   */
  time (format = 'YYYY-MM-DD HH:mm:ss') {
    return moment().format(format)
  }
}

/**
 * 随机一个Bot给全部主人、管理员发送消息
 * @param message 消息内容
 */
export const sendToAllAdmin = async (message: Parameters<typeof karin.sendMsg>[2]
) => {
  const Botlist = karin.getAllBotID()
  const data = Botlist.filter(item => item !== 'console')
  const BotId = data[Math.floor(Math.random() * data.length)]
  const MasterList = [...config.master(), ...config.admin()]
  // 标准输入直接用logger发
  logger.info(message)
  if (!BotId) return false
  for (const id of MasterList) {
    try {
      const contact = karin.contactFriend(id)
      await karin.sendMsg(BotId, contact, message)
    } catch (error) {
      logger.bot('info', BotId, `[${id}] 发送主动消息失败:`)
      logger.error(error)
    }
  }
}

export const common = new Common()
