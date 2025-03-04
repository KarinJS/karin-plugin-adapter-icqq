import { slider, device, qrcode } from './login'
import { CfgType } from '../imports/types'
import {
  Client,
  MessageElem,
  segment as Segment,
  parseGroupMessageId,
  genGroupMessageId,
  axios,
  GroupMessage,
  PrivateMessage
} from 'icqq'
import {
  registerBot,
  Contact,
  logger,
  Role,
  NodeElement,
  Scene,
  GroupInfo,
  AdapterType,
  AdapterBase,
  unregisterBot,
  Elements
} from 'node-karin'
import { parseGroupRequestFlag } from 'icqq/lib/internal/sysmsg.js'
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

  async getVersion () {
    const data = this.adapter.version
    delete (data as { name?: string }).name
    return data
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

  async GetCurrentAccount () {
    return { account_uid: this.account.uid, account_uin: this.account.uin, account_name: this.super.nickname }
  }

  async recallMsg (contact: Contact, message_id: string) {
    if (contact.scene === 'friend') {
      return await this.super.pickFriend(Number(contact.peer)).recallMsg(message_id)
    }
    return await this.super.pickGroup(Number(contact.peer)).recallMsg(message_id)
  }

  async ReactMessageWithEmoji (contact: Contact, message_id: string, face_id: number, is_set: boolean) {
    const { seq } = parseGroupMessageId(message_id)
    return await this.super.pickGroup(Number(contact.peer)).setReaction(seq, face_id + '')
  }

  async VoteUser (target_uid_or_uin: string, vote_count: number) {
    return await this.super.pickFriend(Number(target_uid_or_uin)).thumbUp(vote_count)
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

  async SetEssenceMessage (_group_id: string, message_id: string) {
    const res = await this.super.setEssenceMessage(message_id)
    return typeof res === 'string'
  }

  async DeleteEssenceMessage (_group_id: string, message_id: string) {
    const res = await this.super.removeEssenceMessage(message_id)
    return typeof res === 'string'
  }

  async UploadPrivateFile (user_id: string, file: string, name: string) {
    const res = await this.super.pickFriend(Number(user_id)).sendFile(file, name)
    return typeof res === 'string'
  }

  async UploadGroupFile (group_id: string, file: string, name: string, folder: string) {
    const res = await this.super.pickGroup(Number(group_id)).sendFile(file, folder, name)
    return typeof res === 'string'
  }

  async SetGroupWholeBan (group_id: string, is_ban: boolean) {
    return await this.super.pickGroup(Number(group_id)).muteAll(is_ban)
  }

  async ModifyGroupName (group_id: string, name: string) {
    return await this.super.pickGroup(Number(group_id)).setName(name)
  }

  async SetGroupUniqueTitle (group_id: string, user_id: string, title: string) {
    return await this.super.pickGroup(Number(group_id)).setTitle(Number(user_id), title)
  }

  async ModifyMemberCard (group_id: string, user_id: string, card: string) {
    return await this.super.pickGroup(Number(group_id)).setCard(Number(user_id), card)
  }

  async BanMember (group_id: string, user_id: string, duration: number) {
    return await this.super.pickGroup(Number(group_id)).muteMember(Number(user_id), duration)
  }

  async PokeMember (group_id: string, user_id: string) {
    return await this.super.pickGroup(Number(group_id)).pokeMember(Number(user_id))
  }

  async KickMember (group_id: string, user_id: string, reject_add_request: boolean, msg?: string) {
    return await this.super.pickGroup(Number(group_id)).kickMember(Number(user_id), msg, reject_add_request)
  }

  async SetGroupAdmin (group_id: string, user_id: string, is_admin: boolean) {
    return await this.super.pickGroup(Number(group_id)).setAdmin(Number(user_id), is_admin)
  }

  async LeaveGroup (group_id: string, _reject_add_request: boolean) {
    return await this.super.pickGroup(Number(group_id)).quit()
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

  async UploadForwardMessage (contact: Contact, elements: Array<NodeElement>) {
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
      const result = await this.super.makeForwardMsg(messages, true)
      return result.data.meta.detail.resid
    } else {
      const result = await this.super.makeForwardMsg(messages, false)
      return result.data.meta.detail.resid
    }
  }

  async GetGroupMemberList (group_id: string, refresh?: boolean) {
    const result = await this.super.pickGroup(Number(group_id)).getMemberMap(refresh)
    const members = []
    for (const [key, value] of result.entries()) {
      const unfriendly = await this.GetGroupMemberInfo(group_id, key + '')
      members.push({
        uid: key + '',
        uin: key + '',
        nick: value.nickname,
        age: value.age,
        unique_title: value.title || '',
        unique_title_expire_time: value.title_expire_time || 0,
        card: value.card || '',
        join_time: value.join_time || 0,
        last_active_time: value.update_time || 0,
        level: value.level,
        shut_up_time: value.shutup_time,
        distance: 0,
        honors: [],
        unfriendly: unfriendly.unfriendly,
        card_changeable: undefined,
        role: value.role as Role,
      })
    }
    return members
  }

  async GetGroupMemberInfo (groupId: string, targetId: string, refresh?: boolean) {
    const userId = Number(targetId)
    const result = await this.super.getGroupMemberInfo(groupId, targetId, refresh)
    return {
      userId: targetId,
      role: result.role,
      nick: result.nick || '',
      age: result.age || 0,
      uniqueTitle: result.uniqueTitle,
      card: result.card
    }
  }

  async GetGroupInfo (group_id: string, no_cache?: boolean): Promise<GroupInfo> {
    const result = await this.super.getGroupInfo(Number(group_id), no_cache)

    /** 从群成员中提取出所有管理 */
    const admins = []
    const gl = await this.super.getGroupMemberList(Number(group_id), no_cache)
    for (const [key, value] of gl.entries()) {
      if (value.role === 'admin') admins.push(key + '')
    }

    return {
      group_id,
      group_name: result.group_name,
      group_remark: result.group_name,
      max_member_count: result.max_member_count,
      member_count: result.member_count,
      group_uin: group_id,
      admins,
      owner: result.owner_id + '',
    }
  }

  async DownloadForwardMessage (res_id: string): Promise<Array<PushMessageBody>> {
    const result = await this.super.getForwardMsg(res_id)
    const messages: Array<PushMessageBody> = []

    await Promise.all(result.map(async (v: { message: MessageElem[] | undefined; time: any; seq: any; user_id: string; nickname: any; group_id: string }) => {
      const elements = await this.AdapterConvertKarin(v.message)
      messages.push({
        elements,
        time: v.time,
        message_id: '',
        message_seq: v.seq,
        sender: {
          uid: v.user_id + '',
          uin: v.user_id + '',
          nick: v.nickname || '',
          role: Role.Unknown,
        },
        contact: {
          scene: v.group_id ? Scene.Group : Scene.Private,
          peer: v.group_id + '' || v.user_id + '',
          sub_peer: null,
        },
      })
    }))

    return messages
  }

  async SetFriendApplyResult (request_id: string, is_approve: boolean, remark?: string) {
    return await this.super.setFriendAddRequest(request_id, is_approve, remark)
  }

  async SetGroupApplyResult (request_id: string, is_approve: boolean, deny_reason?: string) {
    return await this.super.setGroupAddRequest(request_id, is_approve, deny_reason)
  }

  async SetInvitedJoinGroupResult (request_id: string, is_approve: boolean) {
    const { group_id, user_id, seq } = parseGroupRequestFlag(request_id)
    return await this.super.pickUser(Number(user_id)).setGroupInvite(group_id, seq, is_approve)
  }

  async GetGroupList (refresh?: boolean): Promise<Array<GroupInfo>> {
    const list = []
    const result = this.super.getGroupList()
    if (refresh) await this.super.reloadGroupList()
    for (const [key, value] of result.entries()) {
      const admins = []

      const gl = await this.super.getGroupMemberList(Number(key), refresh)
      for (const [key, value] of gl.entries()) {
        if (value.role === 'admin') admins.push(key + '')
      }

      list.push({
        group_id: key + '',
        group_name: value.group_name,
        group_remark: value.group_name,
        max_member_count: value.max_member_count,
        member_count: value.member_count,
        group_uin: key + '',
        admins,
        owner: value.owner_id + '',
      })
    }

    return list
  }

  async GetFriendList (refresh?: boolean): Promise<Array<FriendInfo>> {
    const list: Array<FriendInfo> = []
    if (refresh) await this.super.reloadFriendList()
    const result = this.super.getFriendList()

    for (const [key, value] of result.entries()) {
      list.push({
        uid: key + '',
        uin: key + '',
        qid: key + '',
        nick: value.nickname,
        remark: value.remark,
        sex: value.sex,
        level: undefined,
        birthday: undefined,
        login_day: undefined,
        vote_cnt: undefined,
        is_school_verified: undefined,
        age: undefined,
        ext: {
          big_vip: undefined,
          hollywood_vip: undefined,
          qq_vip: undefined,
          super_vip: undefined,
          voted: undefined,
        },
      })
    }

    return list
  }

  async sendLongMsg (contact: Contact, resId: string) {
    let result
    const { scene, peer } = contact
    if (scene === 'group') {
      result = await this.super.pickGroup(peer).sendMsg
    }
  }

  async GetStrangerProfileCard (target_uid_or_uin: string[]): Promise<Array<FriendInfo>> {
    const info = await this.super.getStrangerInfo(Number(target_uid_or_uin[0]))
    return [
      {
        uid: info.user_id + '',
        uin: info.user_id + '',
        qid: info.user_id + '',
        nick: info.nickname,
        sex: info.sex,
        remark: undefined,
        level: undefined,
        birthday: undefined,
        login_day: undefined,
        vote_cnt: undefined,
        is_school_verified: undefined,
        age: undefined,
        ext: {
          big_vip: undefined,
          hollywood_vip: undefined,
          qq_vip: undefined,
          super_vip: undefined,
          voted: undefined,
        },
      },
    ]
  }

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

  async GetGroupHonor (group_id: string, refresh?: boolean): Promise<Array<GroupHonorInfo>> {
    const list: Array<GroupHonorInfo> = []

    const api = async (type: number) => {
      const Cookie = this.super.cookies['qun.qq.com']
      const url = `https://qun.qq.com/interactive/honorlist?gc=${group_id}&type=${type}`
      const result = await axios.get(url, { headers: { Cookie } })
      const text = result.data.match(/window\.__INITIAL_STATE__=(.*?);/)[1].replace(/\\/g, '\\\\')
      const data = JSON.parse(text)
      return type === 1 ? data.talkativeList : data.actorList
    }

    /** 龙王 */
    const king = await api(1)
    list.push({
      uid: king.uin + '',
      uin: king.uin + '',
      nick: king.name,
      honor_name: '龙王',
      avatar: king.avatar,
      id: 1,
      description: king.desc,
    })

    /** 群聊之火 */
    const fire = await api(2)
    list.push({
      uid: fire.uin + '',
      uin: fire.uin + '',
      nick: fire.name,
      honor_name: '群聊之火',
      avatar: fire.avatar,
      id: 2,
      description: fire.desc,
    })

    /** 群聊炽焰 */
    const flame = await api(3)
    list.push({
      uid: flame.uin + '',
      uin: flame.uin + '',
      nick: flame.name,
      honor_name: '群聊炽焰',
      avatar: flame.avatar,
      id: 3,
      description: flame.desc,
    })

    /** 快乐源泉 */
    const spring = await api(6)
    list.push({
      uid: spring.uin + '',
      uin: spring.uin + '',
      nick: spring.name,
      honor_name: '快乐源泉',
      avatar: spring.avatar,
      id: 6,
      description: spring.desc,
    })

    return list
  }

  async GetEssenceMessageList (group_id: string, page: number = 0, page_size: number = 20): Promise<Array<EssenceMessageBody>> {
    if (page_size > 50) page_size = 50

    const list: Array<EssenceMessageBody> = []

    const random = Math.floor(Math.random() * 10000)
    const url = `https://qun.qq.com/cgi-bin/group_digest/digest_list?random=${random}&X-CROSS-ORIGIN=fetch&group_code=${group_id}&page_start=${page}&page_limit=${page_size}&bkn=${this.super.bkn}`

    const headers = {
      Host: 'qun.qq.com',
      'User-Agent': 'QQ/8.9.28.635 CFNetwork/1312 Darwin/21.0.0',
      Connection: 'keep-alive',
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'zh-CN',
      Cookie: this.super.cookies['qun.qq.com'],
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    }

    const result = await axios.get(url, { headers })

    for (const v of result.data.data?.msg_list || []) {
      /** 组合message_id */
      const message_id = genGroupMessageId(Number(group_id), Number(v.sender_uin), v.msg_seq, v.msg_random, v.sender_time)
      list.push({
        group_id,
        sender_uid: v.sender_uin,
        sender_uin: v.sender_uin,
        sender_nick: v.sender_nick,
        operator_uid: v.add_digest_uin,
        operator_uin: v.add_digest_uin,
        operator_nick: v.add_digest_nick,
        operation_time: v.add_digest_time,
        message_time: v.sender_time,
        message_id,
        message_seq: v.msg_seq,
        json_elements: JSON.stringify(v.msg_content),
      })
    }

    return list
  }

  async GetRemainCountAtAll (group_id: string): Promise<GetRemainCountAtAllResponse> {
    const res = await this.super.pickGroup(Number(group_id)).getAtAllRemainder()
    return {
      access_at_all: res > 0,
      remain_count_for_group: res,
      remain_count_for_self: 0,
    }
  }

  async ModifyGroupRemark (group_id: string, remark: string) {
    return await this.super.pickGroup(Number(group_id)).setRemark(remark)
  }

  async GetProhibitedUserList (group_id: string): Promise<Array<{
    uid: string
    uin: string
    prohibited_time: number
  }>> {
    const list: Array<{ uid: string, uin: string, prohibited_time: number }> = []

    /** 获取群成员列表 */
    const members = await this.GetGroupMemberList(group_id)

    for (const member of members) {
      if (member.shut_up_time) {
        list.push({
          uid: member.uid,
          uin: member.uin,
          prohibited_time: member.shut_up_time,
        })
      }
    }

    return list
  }

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
