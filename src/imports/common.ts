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

export const common = new Common()
