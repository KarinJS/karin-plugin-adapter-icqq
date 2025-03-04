import { slider, device, qrcode } from './login'
import { CfgType } from '../imports/types'
import {
  Client,
  segment as Segment,
  GroupMessage,
  PrivateMessage
} from 'icqq'
import {
  registerBot,
  Contact,
  logger,
  Role,
  NodeElement,
  AdapterType,
  AdapterBase,
  unregisterBot,
  Elements
} from 'node-karin'
import { createMessage } from '../create/message'
import { createNoice } from 'src/create/notice'
import { AdapterConvertKarin, KarinConvertAdapter } from './convert'

/**
 * - ICQQ适配器
 */
export class AdapterICQQ extends AdapterBase implements AdapterType {
  constructor (bot: CfgType, version: string) {
    super()
    const selfId = String(bot.qq)
    this.account.uid = selfId
    this.account.uin = selfId
    this.account.name = ''
    this.account.selfId = selfId
    this.account.avatar = ''
    this.adapter.name = 'ICQQ'
    this.adapter.index = 0
    this.adapter.version = version
    this.adapter.platform = 'qq'
    this.adapter.standard = 'icqq'
    this.adapter.protocol = 'icqq'
    this.adapter.communication = 'other'
    this.super = new Client(bot.cfg)
  }

  async init (bot: CfgType) {
    this.super.on('system.online', () => {
      this.logger('info', '登录成功~')
      this.account.name = this.super.nickname
      /** 注册bot */
      const index = registerBot('other', this)
      if (index) this.adapter.index = index
    })

    /** 监听掉线 掉线后卸载bot */
    this.super.on('system.offline', () => {
      unregisterBot('index', this.adapter.index)
    })

    this.super.on('message', async (data: any) => {
      createMessage(data, this)
    })

    this.super.on('notice.group', async (data: any) => {
      createNoice(data, this)
    })

    /** 扫码登录 */
    this.super.on('system.login.qrcode', (event: { image: Buffer<ArrayBufferLike> }) => qrcode(event.image, this))

    /** 遇到滑动验证码(滑块) */
    this.super.on('system.login.slider', (event: { url: string }) => slider(event.url, this))

    /** 遇到短信验证码(包含真假设备锁) */
    this.super.on('system.login.device', (event: { url: string; phone: string }) => device(event, this))

    /** 遇到登录错误的信息 */
    this.super.on('system.login.error', (event: { code: any; message: any }) => {
      this.logger('error', `[登录错误] 错误代码: ${event.code}`)
      this.logger('error', `[登录失败] 错误信息: ${event.message}`)
    })

    await this.super.login(bot.qq, bot.password)
  }

  get self_id () {
    return this.account.uid
  }

  logger (level: 'info' | 'error' | 'trace' | 'debug' | 'mark' | 'warn' | 'fatal', ...args: any[]) {
    logger.bot(level, this.account.uid || this.account.uin, ...args)
  }

  async sendMsg (contact: Contact, elements: Array<Elements>) {
    const message = await KarinConvertAdapter(this, elements)
    if (contact.scene === 'friend') {
      return await this.super.pickFriend(Number(contact.peer)).sendMsg(message)
    }
    return await this.super.pickGroup(Number(contact.peer)).sendMsg(message)
  }

  /**
   * 获取头像url
   * @param size 头像大小，默认`0`
   * @returns 头像的url地址
   */
  async getAvatarUrl (user_id: string, size: 0 | 40 | 100 | 140 = 0) {
    return `https://q1.qlogo.cn/g?b=qq&s=${size}&nk=` + user_id
  }

  /**
   * 获取群头像url
   * @param size 头像大小，默认`0`
   * @param history 历史头像记录，默认`0`，若要获取历史群头像则填写1,2,3...
   * @returns 头像的url地址
   */
  async getGroupAvatarUrl (group_id: string, size: 0 | 40 | 100 | 140 = 0, history = 0) {
    return `https://p.qlogo.cn/gh/${group_id}/${group_id}${history ? '_' + history : ''}/` + size
  }

  async recallMsg (contact: Contact, message_id: string) {
    if (contact.scene === 'friend') {
      return await this.super.pickFriend(Number(contact.peer)).recallMsg(message_id)
    }
    return await this.super.pickGroup(Number(contact.peer)).recallMsg(message_id)
  }

  async sendForwardMsg (contact: Contact, elements: NodeElement[]) {
    const userId = Number(this.account.uid)
    const nickName = this.account.name
    const messages = []

    for (const v of elements) {
      const user_id = v.subType === 'fake' ? Number(v.userId) : userId
      const nickname = v.subType === 'fake' ? v.nickname : nickName
      const content = v.subType === 'messageID' ? (await this.getForwardMsg(v.messageId))[0].elements : v.message
      const message = await KarinConvertAdapter(this, content)
      messages.push(Segment.fake(user_id, message, nickname))
    }

    if (contact.scene === 'friend') {
      const res = await this.super.makeForwardMsg(messages, true)
      return await this.super.pickFriend(Number(contact.peer)).sendMsg(res)
    } else {
      const res = await this.super.makeForwardMsg(messages, false)
      return await this.super.pickGroup(Number(contact.peer)).sendMsg(res)
    }
  }

  async getMsg (contact: Contact, messageId: string) {
    const res = await this.super.getMsg(messageId) as GroupMessage | PrivateMessage
    if (!res) throw TypeError('消息不存在')
    const userId = String(res.sender.user_id)
    const elements = AdapterConvertKarin(this, res.message)
    return {
      time: res.time,
      messageId: res.message_id,
      message_id: res.message_id,
      message_seq: res.seq,
      messageSeq: res.seq,
      contact: {
        scene: res.message_type === 'group' ? 'group' as const : 'friend' as const,
        peer: contact.peer,
        sub_peer: null,
        name: ''
      },
      sender: {
        userId,
        uid: userId,
        uin: res.sender.user_id,
        nick: res.sender.nickname,
        role: 'unknown' as const,
        name: res.sender.nickname
      },
      elements
    }
  }

  // async getForwardMsg (res_id: string) {
  // }

  // async sendLongMsg (contact: Contact, resId: string) {
  // }

  async getHistoryMsg (contact: Contact, startMsgId: string, count: number) {
    const res = await this.super.getChatHistory(startMsgId, count) as GroupMessage[] | PrivateMessage[]
    const all = []
    for (const v of res) {
      const userId = String(v.sender.user_id)
      const messageId = v.message_id
      const messageSeq = v.seq

      const data = {
        time: Date.now(),
        messageId,
        messageSeq,
        message_id: messageId,
        message_seq: messageSeq,
        contact,
        sender: {
          userId,
          uid: userId,
          uin: v.sender.user_id,
          nick: v?.sender?.nickname || '',
          name: v?.sender?.nickname || '',
          role: 'role' in v.sender && ['owner', 'admin', 'member'].includes(v.sender.role) ? v.sender.role as Role : 'unknown',
          card: 'card' in v.sender ? v.sender.card : ''
        },
        elements: AdapterConvertKarin(this, v.message)
      }
      all.push(data)
    }
    return all
  }

  // async getGroupHighlights (group_id: string, page: number = 0, page_size: number = 20) {
  // }

  // 以下方法暂不打算实现
  async UploadFile (): Promise<any> { throw new Error('Method not implemented.') }
  async DownloadFile (): Promise<any> { throw new Error('Method not implemented.') }
  async CreateFolder (): Promise<any> { throw new Error('Method not implemented.') }
  async RenameFolder (): Promise<any> { throw new Error('Method not implemented.') }
  async DeleteFolder (): Promise<any> { throw new Error('Method not implemented.') }
  async DeleteFile (): Promise<any> { throw new Error('Method not implemented.') }
  async GetFileList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetFileSystemInfo (): Promise<any> { throw new Error('Method not implemented.') }
  async SetMessageReaded (): Promise<any> { throw new Error('Method not implemented.') }
}
