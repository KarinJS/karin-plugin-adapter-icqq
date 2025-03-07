import { Agent } from 'https'
import { AdapterICQQ } from './index'
import { logger, karin, segment, common } from 'node-karin'
import axios from 'node-karin/axios'
import WebSocket from 'node-karin/ws'
import { sendToAllAdmin } from '@plugin'

let sendMsg = sendToAllAdmin
const events = (id: number) => new Promise(resolve =>
  karin.once(`ICQQLogin.${id}`, data => {
    sendMsg = data.reply
    resolve(data.msg)
  })
)
/**
 * 处理滑块验证码
 */
export async function slider (url: string, bot: AdapterICQQ) {
  try {
    sendMsg([
      `[${bot.account.selfId}]触发滑块验证码,请选择验证方式:`,
      `网页验证: #QQ验证${bot.account.selfId}:网页`,
      `手动验证: #QQ验证${bot.account.selfId}:ticket`,
      url
    ].join('\n'))
    const uid = bot.account.uid
    const msg = await events(Number(uid))
    let ticket
    switch (msg) {
      case '网页':
        ticket = await autoSlider(uid, url)
        break
      default:
        ticket = msg
    }

    await bot.super.submitSlider(ticket)
  } catch {}
}

/**
 * 扫码登录
 * @param image 二维码图片
 * @param adapter 适配器实例
 */
export async function qrcode (image: Buffer, bot: AdapterICQQ) {
  sendMsg(segment.image(String(image)))
  while (true) {
    await common.sleep(3000)
    const { retcode } = await bot.super.queryQrcodeResult()
    switch (retcode) {
      case 0:
        return bot.super.qrcodeLogin()
      case 17:
        return sendMsg(`二维码过期,发送#QQ登录${bot.account.selfId} 重新登录`)
      case 54:
        return sendMsg(`登录取消,发送#QQ登录${bot.account.selfId} 重新登录`)
    }
  }
}

/**
 * 自动过滑块
 * 由hlhs授权提供，感谢大佬的支持~ https://gitee.com/Mozz2020
 */
export async function autoSlider (uid: string, url: string): Promise<string> {
  // 用户访问url
  const page = `https://hanxuan-gt.hf.space/captcha/slider?key=${uid}`
  const socket = new WebSocket(page)
  socket.on('error', () => logger.error('websocket连接失败,请检查你的dns设置或者网络是否正常'))
  socket.on('open', () => {
    socket.send(JSON.stringify({ type: 'register', payload: { url } }))
    sendMsg(page)
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
export async function device (event: { url: string, phone: string }, bot: AdapterICQQ) {
  try {
    sendMsg([
      `[${bot.account.selfId}]触发设备锁验证，请选择验证方式:`,
      `短信验证: #QQ验证${bot.account.selfId}:短信`,
      `网页扫码: 扫码完成后输入 #QQ验证${bot.account.selfId}:继续登录`,
      event.url
    ].join('\n'))
    while (true) {
      const msg = await events(Number(bot.account.selfId))
      if (msg === '短信') {
        bot.super.sendSmsCode()
        sendMsg(`[${bot.account.selfId}] 短信验证码已发送,#QQ验证${bot.account.selfId}:验证码`)
        bot.super.submitSmsCode(await events(Number(bot.account.selfId)))
        break
      } else if (msg === '继续登录') {
        bot.super.login()
        break
      }
    }
  } catch {}
}
