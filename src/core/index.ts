import {
  Client,
  segment as Segment,
  GroupMessage,
  PrivateMessage,
  genGroupMessageId,
  FriendInfo,
  GroupInfo,
  MemberInfo,
  parseGroupMessageId
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
  Elements,
  GetGroupHighlightsResponse,
  GroupSender,
  senderGroup,
  SendMsgResults,
} from 'node-karin'
import type { Message } from 'node-karin'
import { AdapterConvertKarin, KarinConvertAdapter } from './convert'
import axios from 'node-karin/axios'
import { sendToAllAdmin, CfgType } from '@/imports'
import { createMessage, createNoice, createRequest } from '@/create'
import { Login } from './login'

/**
 * - ICQQ适配器
 */
export class AdapterICQQ extends AdapterBase implements AdapterType {
  super: Client
  constructor (bot: CfgType, version: string) {
    super()
    const selfId = String(bot.qq)
    this.account.uid = selfId
    this.account.uin = selfId
    this.account.name = ''
    this.account.selfId = selfId
    this.account.avatar = `https://q1.qlogo.cn/g?b=qq&s=0&nk=${selfId}`
    this.adapter.name = 'ICQQ'
    this.adapter.index = 0
    this.adapter.version = version
    this.adapter.platform = 'qq'
    this.adapter.standard = 'icqq'
    this.adapter.protocol = 'icqq'
    this.adapter.communication = 'other'
    this.super = new Client(bot.cfg)
  }

  async init (bot: CfgType, e?: Message) {
    const login = new Login(e)
    this.super.on('system.online', () => {
      this.logger('info', '登录成功~')
      this.account.name = this.super.nickname
      /** 注册bot */
      const index = registerBot('other', this)
      if (index) this.adapter.index = index
    })

    /** 监听掉线 掉线后卸载bot并发送消息到所有主人 */
    this.super.on('system.offline', (event: { message: string }) => {
      unregisterBot('index', this.adapter.index)
      sendToAllAdmin(`[${this.selfId}]账号下线:\n${event.message}\n发送#QQ上线${this.selfId} 重新登陆`)
    })

    this.super.on('message', async (data: any) => {
      createMessage(data, this)
    })

    this.super.on('notice', async (data: any) => {
      createNoice(data, this)
    })

    this.super.on('request', async (data: any) => {
      createRequest(data, this)
    })

    /** 扫码登录 */
    this.super.on('system.login.qrcode', (event: { image: Buffer<ArrayBufferLike> }) => login.qrcode(event.image, this))

    /** 遇到滑动验证码(滑块) */
    this.super.on('system.login.slider', (event: { url: string }) => login.slider(event.url, this))

    /** 遇到短信验证码(包含真假设备锁) */
    this.super.on('system.login.device', (event: { url: string; phone: string }) => login.device(event, this))

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
    const result: SendMsgResults = {
      messageId: '',
      time: Date.now(),
      rawData: {},
      message_id: '',
      messageTime: Date.now()
    }

    const message = await KarinConvertAdapter(this, elements)
    const res = contact.scene === 'friend'
      ? await this.super.pickFriend(Number(contact.peer)).sendMsg(message)
      : await this.super.pickGroup(Number(contact.peer)).sendMsg(message)

    result.messageId = res.message_id
    result.rawData = res
    result.time = res.time
    result.messageTime = res.time
    result.message_id = res.message_id
    return result
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

    // TODO: 转发消息ID
    const result: { messageId: string, forwardId: string } = { messageId: '', forwardId: '' }

    if (contact.scene === 'friend') {
      const data = await this.super.makeForwardMsg(messages, true)
      const res = await this.super.pickFriend(Number(contact.peer)).sendMsg(data)
      result.messageId = res.message_id
    } else {
      const data = await this.super.makeForwardMsg(messages, false)
      const res = await this.super.pickGroup(Number(contact.peer)).sendMsg(data)
      result.messageId = res.message_id
    }
    return result
  }

  async getMsg (contact: Contact, messageId: string) {
    const res = await this.super.getMsg(messageId) as GroupMessage | PrivateMessage
    if (!res) throw TypeError('消息不存在')
    const userId = String(res.sender.user_id)
    const elements = await AdapterConvertKarin(this, res.message, contact, res.source)
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
        elements: await AdapterConvertKarin(this, v.message, contact, v.source)
      }
      all.push(data)
    }
    return all
  }

  async getGroupHighlights (groupId: string, page: number = 0, pageSize: number = 20) {
    const list: Array<GetGroupHighlightsResponse & {
      group_id: string
      sender_uid: string
      sender_uin: string
      sender_nick: string
      operator_uid: string
      operator_uin: string
      operator_nick: string
      operation_time: number
      message_time: number
      message_id: string
      message_seq: number
      json_elements: string
    }> = []
    const url = `https://qun.qq.com/cgi-bin/group_digest/digest_list?bkn=${this.super.bkn}&bkn=${this.super.bkn}&group_code=${groupId}&page_start=${page}&page_limit=${pageSize}`
    const headers = {
      Cookie: this.super.cookies['qun.qq.com']
    }
    const res = await axios.get(url, { headers })

    for (const v of res.data.data?.msg_list || []) {
      const messageId = genGroupMessageId(Number(groupId), Number(v.sender_uin), v.msg_seq, v.sender_time, v.msg_random)
      list.push({
        groupId,
        senderId: v.sender_uin,
        operatorId: v.add_digest_uin,
        senderName: v.sender_nick,
        operatorName: v.add_digest_nick,
        operationTime: v.add_digest_time,
        messageTime: v.sender_time,
        messageId,
        messageSeq: v.msg_seq,
        jsonElements: JSON.stringify(v.msg_content),
        group_id: groupId,
        sender_uid: v.sender_uin,
        sender_uin: v.sender_uin,
        sender_nick: v.sender_nick,
        operator_uid: v.add_digest_uin,
        operator_uin: v.add_digest_uin,
        operator_nick: v.add_digest_nick,
        operation_time: v.add_digest_time,
        message_time: v.sender_time,
        message_id: messageId,
        message_seq: v.msg_seq,
        json_elements: JSON.stringify(v.msg_content)
      })
    }
    return list
  }

  async setGgroupHighlights (groupId: string, messageId: string, create: boolean) {
    try {
      if (create) {
        await this.super.setEssenceMessage(messageId)
        return true
      } else {
        await this.super.removeEssenceMessage(messageId)
        return true
      }
    } catch {
      return false
    }
  }

  async sendLike (targetId: string, count: number) {
    return await this.super.sendLike(Number(targetId), count)
  }

  async groupKickMember (groupId: string, targetId: string, rejectAddRequest?: boolean | undefined, kickReason?: string | undefined) {
    return await this.super.pickGroup(Number(groupId)).kickMember(Number(targetId), kickReason, rejectAddRequest)
  }

  async setGroupMute (groupId: string, targetId: string, duration: number) {
    return await this.super.pickGroup(Number(groupId)).muteMember(Number(targetId), duration)
  }

  async setGroupAllMute (groupId: string, isBan: boolean) {
    return await this.super.pickGroup(Number(groupId)).muteAll(isBan)
  }

  async setGroupAdmin (groupId: string, targetId: string, isAdmin: boolean) {
    return await this.super.setGroupAdmin(Number(groupId), Number(targetId), isAdmin)
  }

  async setGroupMemberCard (groupId: string, targetId: string, card: string) {
    return await this.super.setGroupCard(Number(groupId), Number(targetId), card)
  }

  async setGroupName (groupId: string, groupName: string) {
    return await this.super.pickGroup(Number(groupId)).setName(groupName)
  }

  async setGroupQuit (groupId: string, isDismiss: boolean) {
    if (isDismiss) return await this.super.pickGroup(Number(groupId)).quit()
    return false
  }

  async setGroupMemberTitle (groupId: string, targetId: string, title: string) {
    return await this.super.pickGroup(Number(groupId)).setTitle(Number(targetId), title)
  }

  async getStrangerInfo (targetId: string) {
    const event = await this.super.getStrangerInfo(Number(targetId))
    return {
      userId: event.user_id + '',
      nick: event.nickname,
      age: event.age,
      sex: event.sex
    }
  }

  async getFriendList (refresh?: boolean | undefined) {
    const friendList: Map<number, FriendInfo> = await this.super.getFriendList()
    return Array.from(friendList.values()).map(v => {
      const userId = String(v.user_id)
      return {
        userId,
        nick: v.nickname,
        sex: v.sex,
        uid: v.user_uid,
        uin: userId,
        remark: v.remark
      }
    })
  }

  async getGroupInfo (groupId: string, noCache?: boolean | undefined) {
    const info = await this.super.getGroupInfo(Number(groupId), noCache) as GroupInfo
    return {
      groupId,
      groupName: info.group_name,
      owner: String(info.owner_id),
      groupRemark: info.group_name,
      admins: [],
      maxMemberCount: info.max_member_count,
      memberCount: info.member_count,
      groupDesc: ''
    }
  }

  async getGroupList (refresh?: boolean | undefined) {
    const info: Map<number, GroupInfo> = await this.super.getGroupList()
    return Array.from(info.values()).map(v => {
      const groupId = String(v.group_id)
      const groupName = v.group_name
      return {
        groupId,
        groupName,
        owner: String(v.owner_id),
        groupRemark: v.group_name,
        admins: [],
        maxMemberCount: v.max_member_count,
        memberCount: v.member_count,
        groupDesc: ''
      }
    })
  }

  async getGroupMemberInfo (groupId: string, targetId: string, refresh?: boolean | undefined) {
    const userId = Number(targetId)
    const info: MemberInfo = await this.super.getGroupMemberInfo(Number(groupId), userId, refresh)
    return {
      userId: targetId,
      nick: info.nickname,
      role: info.role,
      age: info.age,
      area: info.area,
      uniqueTitle: info.title,
      card: info.card,
      joinTime: info.join_time,
      lastActiveTime: info.last_sent_time,
      level: info.level,
      shutUpTime: info.shutup_time,
      distance: undefined,
      honors: [],
      unfriendly: undefined,
      sex: info.sex,
      get sender (): GroupSender {
        return senderGroup(
          this.userId,
          this.role,
          this.nick,
          this.sex,
          this.age,
          this.card,
          this.area,
          this.level
        )
      }
    }
  }

  async getGroupMemberList (groupId: string, refresh?: boolean | undefined) {
    const info: Map<number, MemberInfo> = await this.super.getGroupMemberList(Number(groupId), refresh)
    return Array.from(info.values()).map(v => {
      const targetId = String(v.user_id)
      return {
        userId: targetId,
        uid: targetId,
        uin: targetId,
        nick: v.nickname,
        role: v.role,
        age: v.age,
        area: v.area,
        uniqueTitle: v.title,
        card: v.card,
        joinTime: v.join_time,
        lastActiveTime: v.last_sent_time,
        level: v.level,
        shutUpTime: v.shutup_time,
        distance: undefined,
        honors: [],
        unfriendly: undefined,
        sex: v.sex,
        get sender (): GroupSender {
          return senderGroup(
            targetId,
            this.role,
            this.nick,
            this.sex,
            this.age,
            this.card,
            this.area,
            this.level
          )
        }
      }
    })
  }

  // async getGroupHonor (groupId: string) {
  // }

  async setFriendApplyResult (requestId: string, isApprove: boolean, remark?: string | undefined) {
    return await this.super.setFriendAddRequest(requestId, isApprove, remark)
  }

  async setGroupApplyResult (requestId: string, isApprove: boolean, denyReason?: string | undefined) {
    return await this.super.setGroupAddRequest(requestId, isApprove, denyReason)
  }

  async setInvitedJoinGroupResult (requestId: string, isApprove: boolean) {
    return await this.super.setGroupAddRequest(requestId, isApprove)
  }

  async setMsgReaction (contact: Contact, messageId: string, faceId: number, isSet: boolean) {
    const { group_id, seq } = parseGroupMessageId(messageId)
    return await this.super.pickGroup(group_id).setReaction(seq, String(faceId))
  }

  async uploadFile (contact: Contact, file: string, name: string, folder?: string) {
    try {
      if (contact.scene === 'group') {
        await this.super.pickGroup(Number(contact.peer)).sendFile(file, folder, name)
      } else {
        await this.super.pickFriend(Number(contact.peer)).sendFile(file, name)
      }
      return true
    } catch {
      return false
    }
  }

  // 先暂时不写
  // async downloadFile () {}

  // async pokeUser (contact: Contact, count?: number | undefined) {}
}
