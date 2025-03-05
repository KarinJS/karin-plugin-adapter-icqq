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
 * 给全部主人、管理员发送消息
 * @param selfId Bot的QQ号
 * @param message 消息内容
 */
export const sendToAllAdmin = async (selfId: string, message: Parameters<typeof karin.sendMsg>[2]
) => {
  const list = [...config.master(), ...config.admin()]
  for (const id of list) {
    try {
      const contact = karin.contactFriend(id)
      await karin.sendMsg(selfId, contact, message)
    } catch (error) {
      logger.bot('info', selfId, `[${id}] 发送主动消息失败:`)
      logger.error(error)
    }
  }
}

export const common = new Common()
