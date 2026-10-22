import { AdapterICQQ } from './index'
import { sendToAllAdmin } from '@/common'
import type { Message, SendMessage } from 'node-karin'
import { segment, common } from 'node-karin'

/** 处理登录请求 */
export class Login {
  e: Message | undefined
  sendMsg: any
  constructor (e: Message | undefined) {
    this.e = e
    this.sendMsg = this.e ? (msg: SendMessage) => this.e!.reply(msg, { reply: true }) : sendToAllAdmin
  }

  /**
   * 扫码登录
   * @param image 二维码图片
   * @param adapter 适配器实例
   */
  async qrcode (image: Buffer, bot: AdapterICQQ) {
    this.sendMsg(segment.image(String(image)))
    while (true) {
      await common.sleep(3000)
      const { retcode } = await bot.super.queryQrcodeResult()
      switch (retcode) {
        case 0:
          return bot.super.qrcodeLogin()
        case 17:
          return this.sendMsg(`二维码过期,发送#QQ登录${bot.account.selfId} 重新登录`)
        case 54:
          return this.sendMsg(`登录取消,发送#QQ登录${bot.account.selfId} 重新登录`)
      }
    }
  }
}
