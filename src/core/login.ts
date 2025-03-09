import { Agent } from 'https'
import axios from 'node-karin/axios'
import { AdapterICQQ } from './index'
import WebSocket from 'node-karin/ws'
import { sendToAllAdmin } from '@/imports'
import type { Message, SendMessage } from 'node-karin'
import { getIcqqLoginKey } from '@/tools/key'
import { logger, karin, segment, common } from 'node-karin'
import type { VerifyOptions } from '@/tools/types'

/** 处理登录请求 */
export class Login {
  e: Message | undefined
  sendMsg: any
  constructor (e: Message | undefined) {
    this.e = e
    this.sendMsg = this.e ? (msg: SendMessage) => this.e!.reply(msg, { at: true }) : sendToAllAdmin
  }

  async events (id: number | string): Promise<string> {
    return new Promise(resolve => {
      const key = getIcqqLoginKey(id)
      karin.once(key, (data: VerifyOptions) => {
        this.e = data.e
        this.sendMsg = (msg: SendMessage) => this.e!.reply(msg, { at: true })
        resolve(data.msg)
      })
    })
  }

  /**
 * 处理滑块验证码
 * @param url ticket链接
 * @param bot 适配器实例
 * @param sendMsg 发送消息函数
 */
  async slider (url: string, bot: AdapterICQQ) {
    const sendMsg = this.e ? (msg: SendMessage) => this.e!.reply(msg, { at: true }) : sendToAllAdmin
    sendMsg([
      `[${bot.account.selfId}]触发滑块验证码,请选择验证方式:`,
      `网页验证: #QQ验证${bot.account.selfId}:网页`,
      `手动验证: #QQ验证${bot.account.selfId}:ticket`,
      '手动验证请将ticket替换为你自己获取的ticket',
      url
    ].join('\n'))

    const uid = bot.account.uid
    const msg = await this.events(Number(uid))
    const ticket = msg === '网页' ? await this.autoSlider(uid, url) : msg
    await bot.super.submitSlider(ticket)
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

  /**
 * 自动过滑块
 * 由hlhs授权提供，感谢大佬的支持~ https://gitee.com/Mozz2020
 */
  async autoSlider (uid: string, url: string): Promise<string> {
    // 用户访问url
    const page = `https://hanxuan-gt.hf.space/captcha/slider?key=${uid}`
    const socket = new WebSocket(page)
    socket.on('error', () => logger.error('websocket连接失败,请检查你的dns设置或者网络是否正常'))
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'register', payload: { url } }))
      this.sendMsg(page)
    })
    socket.on('message', async (msg: string) => {
      try {
        const data = JSON.parse(msg)
        if (data.type === 'ticket') {
          const ticket = data.payload.ticket
          logger.mark(`获取Ticket成功: ${ticket}`)
          karin.emit('icqq.slider', ticket)
        } else if (data.type === 'handle') {
          const { url, ...opt } = data.payload

          if (opt.body) {
            opt.data = opt.body
            delete opt.body
          }

          const response = await axios({
            url,
            ...opt,
            httpsAgent: new Agent({ family: 4 }),
            responseType: 'arraybuffer',
          })

          const arrBuf = response.data
          data.payload = {
            result: Buffer.from(arrBuf).toString('base64'),
            headers: response.headers,
          }
          socket.send(JSON.stringify(data))
        }
      } catch { }
    })

    return new Promise(resolve => {
      // 2分钟超时 关闭websocket 返回空字符串
      const timer = setTimeout(() => {
        socket.close()
        resolve('')
      }, 120000)

      karin.once('icqq.slider', ticket => {
        // 成功获取ticket后清除超时
        clearTimeout(timer)
        socket.close()
        resolve(ticket)
      })
    })
  }

  /**
 * 处理设备锁
 */
  async device (event: { url: string, phone: string }, bot: AdapterICQQ) {
    this.sendMsg([
      `[${bot.account.selfId}]触发设备锁验证，请选择验证方式:`,
      `短信验证: #QQ验证${bot.account.selfId}:短信`,
      `网页扫码: 扫码完成后输入 #QQ验证${bot.account.selfId}:继续登录`,
      event.url
    ].join('\n'))
    while (true) {
      const msg = await this.events(Number(bot.account.selfId))
      if (msg === '短信') {
        bot.super.sendSmsCode()
        this.sendMsg(`[${bot.account.selfId}] 短信验证码已发送,#QQ验证${bot.account.selfId}:验证码`)
        bot.super.submitSmsCode(await this.events(Number(bot.account.selfId)))
        break
      } else if (msg === '继续登录') {
        bot.super.login()
        break
      }
    }
  }
}
