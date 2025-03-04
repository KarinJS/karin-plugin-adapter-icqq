import { Agent } from 'https'
import { AdapterICQQ } from './index'
import { logger } from 'node-karin'
import { input, select } from '@inquirer/prompts'
import axios from 'node-karin/axios'
import WebSocket from 'node-karin/ws'

/**
 * 处理滑块验证码
 */
export async function slider (url: string, adapter: AdapterICQQ) {
  try {
    /** 停止内置命令行适配器的监听 */
    process.stdin.emit('stdin.close')

    adapter.logger('info', [
      '\n\n------------------------------------',
      '触发滑块验证码，需要获取ticket，请选择获取方式:',
      `推荐使用 ${logger.green('自动获取')} 方式`,
      '------------------------------------\n',
    ].join('\n'))

    // 获取用户输入
    const res = await select({
      message: '请选择获取方式:',
      choices: [
        { name: '0.自动获取 (hlhs提供 仅需过滑块即可)', value: '0' },
        { name: '1.手动获取 (需要手动打开浏览器过滑块并监听请求获取ticket)', value: '1' },
      ],
    })

    let ticket = ''
    const uid = adapter.account.uid
    if (res === '0') {
      ticket = await autoSlider(uid, url)
      // 如果自动获取失败则使用手动获取
      if (!ticket) ticket = await manualSlider(uid, url)
    } else {
      ticket = await manualSlider(uid, url)
    }

    await adapter.super.submitSlider(ticket)
  } finally {
    /** 重新开启内置命令行适配器的监听 */
    process.stdin.emit('stdin.open')
  }
}

/**
 * 扫码登录
 * @param image 二维码图片
 * @param adapter 适配器实例
 */
export async function qrcode (image: Buffer, adapter: AdapterICQQ) {
  /** 停止监听 */
  process.stdin.emit('stdin.close')
  /** 监听一次回车 */
  await input({ message: '请扫码登录后按回车键继续...' })
  /** 重新监听 */
  process.stdin.emit('stdin.open')
  await adapter.super.login()
}

/**
 * 自动过滑块
 * 由hlhs授权提供，感谢大佬的支持~ https://gitee.com/Mozz2020
 */
export async function autoSlider (uid: string, url: string): Promise<string> {
  // 用户访问url
  const page = `https://hanxuan-gt.hf.space/captcha/slider?key=${uid}`
  const socket = new WebSocket(page)
  socket.on('error', () => logger.error('websocket连接失败，请检查你的dns设置或者网络是否正常'))
  socket.on('open', () => {
    socket.send(JSON.stringify({ type: 'register', payload: { url } }))
    logger.bot('info', uid, [
      '\n\n------------------------------------',
      `请打开链接进行验证: ${logger.green(page)}`,
      '温馨提示: 请勿关闭当前窗口，你需要在2分钟内打开链接进行验证~\n',
    ].join('\n'))
  })
  socket.on('message', async (msg: string) => {
    try {
      const data = JSON.parse(msg)
      if (data.type === 'ticket') {
        const ticket = data.payload.ticket
        logger.mark(`获取Ticket成功: ${ticket}`)
        listener.emit('icqq.slider', ticket)
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

    listener.once('icqq.slider', ticket => {
      // 成功获取ticket后清除超时
      clearTimeout(timer)
      socket.close()
      resolve(ticket)
    })
  })
}

/**
 * 手动过滑块
 */
export async function manualSlider (uid: string, url: string): Promise<string> {
  logger.bot('info', uid, [
    '\n\n------------------------------------',
    `请打开链接获取ticket: ${logger.green(url)}`,
    '参考教程: https://cloud.tencent.com/developer/article/2243916',
  ].join('\n'))
  const res = await input({ message: '请输入获取到的ticket:' })
  if (!res) {
    logger.bot('info', uid, 'ticket不能为空')
    return ''
  }
  return res
}

/**
 * 处理设备锁
 */
export async function device (event: { url: string, phone: string }, adapter: AdapterICQQ) {
  try {
    /** 停止内置命令行适配器的监听 */
    process.stdin.emit('stdin.close')

    adapter.logger('info', [
      '\n\n------------------------------------',
      '触发设备锁验证，请选择验证方式:',
      '0.短信验证 (发送验证码到密保手机)',
      '1.网页扫码 (使用已登录的设备扫码验证)',
      '------------------------------------\n',
    ].join('\n'))

    // 获取用户输入
    const res = await select({
      message: '请选择验证方式:',
      choices: [
        { name: '短信验证 (发送验证码到密保手机)', value: '0' },
        { name: '网页扫码 (使用已登录的设备扫码验证)', value: '1' },
      ],
    })

    if (res === '1') {
      adapter.logger('info', [
        '\n\n------------------------------------',
        '请复制链接从浏览器打开进行验证:',
        '登录保护验证URL: ' + logger.green(event.url),
        '密保手机号: ' + logger.green(event.phone),
        '温馨提示: 请勿关闭当前窗口，验证完成后，请按回车进行登录\n',
      ].join('\n'))

      await input({ message: '等待验证完成...' })

      return await adapter.super.login()
    }

    await adapter.super.sendSmsCode()
    logger.bot('mark', '已发送短信验证码，请输入收到的短信验证码')
    const resCode = await input({
      message: '请输入收到的短信验证码:',
      validate: (input) => {
        if (!input) return '验证码不能为空'
        if (!Number(input)) return '验证码必须是纯数字'
        return true
      },
    })
    return adapter.super.submitSmsCode(resCode)
  } finally {
    /** 重新开启内置命令行适配器的监听 */
    process.stdin.emit('stdin.open')
  }
}
