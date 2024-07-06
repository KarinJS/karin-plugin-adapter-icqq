import { slider, device } from './login'
import { CfgType } from '../imports/types'
import { Client, MessageElem, segment as Segment, parseGroupMessageId } from '@icqqjs/icqq'
import { listener, KarinMessage, KarinAdapter, contact, KarinElement, logger, segment, Role, KarinNotice, NoticeType, KarinNodeElement } from 'node-karin'

/**
 * - ICQQ适配器
 */
export class AdapterICQQ implements KarinAdapter {
  socket!: WebSocket
  account: KarinAdapter['account']
  adapter: KarinAdapter['adapter']
  version: KarinAdapter['version']
  super: Client
  constructor (bot: CfgType, name: string, version: string) {
    const self_id = String(bot.qq)
    this.account = { uid: self_id, uin: self_id, name: '' }
    this.adapter = { id: 'QQ', name: 'ICQQ', type: 'internal', sub_type: 'internal', start_time: Date.now(), connect: '', index: 0 }
    this.version = { name, app_name: name, version }
    this.super = new Client(bot.cfg)
  }

  async init (bot: CfgType) {
    this.super.on('system.online', () => {
      this.logger('info', '登录成功~')
      this.account.name = this.super.nickname
      /** 注册bot */
      const index = listener.addBot({ bot: this, type: this.adapter.type })
      if (index) this.adapter.index = index
    })

    /** 监听掉线 掉线后卸载bot */
    this.super.on('system.offline', () => {
      listener.delBot(this.adapter.index)
    })

    this.super.on('message', async data => {
      if ('discuss' in data) return
      const elements = await this.AdapterConvertKarin(data.message)
      const message = {
        event: (data.post_type) as 'message',
        event_id: data.message_id + '',
        self_id: this.account.uid + '',
        user_id: data.sender.user_id + '',
        time: data.time,
        message_id: data.message_id + '',
        message_seq: data.seq + '',
        sender: {
          ...data.sender,
          uid: data.sender.user_id + '',
          uin: data.sender.user_id + '',
          nick: data.sender.nickname || '',
          role: ('role' in data.sender ? data.sender.role || '' : '') as Role,
        },
        elements,
        contact: {
          scene: (data.message_type === 'private' ? 'friend' : 'group') as 'friend' | 'group',
          peer: data.message_type === 'private' ? data.sender.user_id + '' : data.group_id + '',
          sub_peer: '',
        },
        group_id: data.message_type === 'group' ? data.group_id + '' : '',
        raw_message: '',
      }

      const e = new KarinMessage(message)
      e.bot = this
      /**
       * 快速回复 开发者不应该使用这个方法，应该使用由karin封装过后的reply方法
       */
      e.replyCallback = async elements => {
        const message = await this.KarinConvertAdapter(elements)
        return data.reply(message)
      }

      listener.emit('message', e)
    })

    this.super.on('notice.group', async data => {
      let notice: KarinNotice
      const self_id = this.account.uid
      const time = Date.now()
      const user_id = data.user_id + ''
      const event_id = `notice.${user_id}.${time}`
      const group_id = data.group_id + ''

      const contact = {
        scene: 'group' as 'group',
        peer: group_id,
        sub_peer: group_id,
      }

      const sender = {
        uid: user_id,
        uin: user_id,
        nick: '',
        role: 'unknown' as Role,
      }

      switch (data.sub_type) {
        case 'sign': {
          sender.nick = data.nickname
          const content = {
            group_id,
            target_uid: data.user_id + '',
            target_uin: data.user_id + '',
            action: data.sign_text,
            rank_image: '',
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: 'group_sign_in' as 'group_sign_in',
            group_id,
          }
          notice = new KarinNotice(options)
          break
        }
        case 'increase': {
          const content = {
            group_id: data.group_id + '',
            operator_uid: '', // icqq没有提供操作者信息
            operator_uin: '',
            target_uid: user_id,
            target_uin: user_id,
            type: 'invite' as NoticeType['group_member_increase']['type'],
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: 'group_member_increase' as 'group_member_increase',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'decrease': {
          let type = '' as NoticeType['group_member_decrease']['type']
          /** 如果操作号跟user_id一致 主动退群 */
          if (data.operator_id === data.user_id) {
            type = 'leave'
          } else if (user_id === self_id) {
            /** 登录号被踢 */
            type = 'kick_me'
          } else {
            /** 被踢出 */
            type = 'kick'
          }

          const operator_id = data.operator_id + ''

          const content = {
            group_id,
            operator_uid: operator_id,
            operator_uin: operator_id,
            target_uid: user_id,
            target_uin: user_id,
            type,
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: 'group_member_decrease' as 'group_member_decrease',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'recall': {
          const operator_id = data.operator_id + ''
          const content = {
            group_id,
            operator_uid: operator_id,
            operator_uin: operator_id,
            target_uid: user_id,
            target_uin: user_id,
            message_id: data.message_id,
            tip_text: '撤回了一条消息',
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: 'group_recall' as 'group_recall',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'poke': {
          const operator_id = data.operator_id + ''
          const target_id = data.target_id + ''
          const content = {
            group_id,
            operator_uid: operator_id,
            operator_uin: operator_id,
            target_uid: target_id,
            target_uin: target_id,
            action: data.action,
            suffix: data.suffix,
            action_image: '',
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: 'group_poke' as 'group_poke',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'admin': {
          const content = {
            group_id,
            target_uid: user_id,
            target_uin: user_id,
            is_admin: data.set,
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: 'group_admin_changed' as 'group_admin_changed',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'ban': {
          const operator_id = data.operator_id + ''
          const content = {
            group_id,
            operator_uid: operator_id,
            operator_uin: operator_id,
            target_uid: '', // icqq没有提供被禁言者信息
            target_uin: '',
            duration: data.duration,
            type: data.sub_type,
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: 'group_member_ban' as 'group_member_ban',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'transfer': {
          logger.bot('info', '群转让事件[暂未适配]: ', JSON.stringify(data))
          return
        }
      }

      listener.emit('notice', notice)
    })

    this.super.on('notice.friend', async data => {
      let notice: KarinNotice
      const self_id = this.account.uid
      const time = Date.now()
      const user_id = data.user_id + ''
      const event_id = `notice.${user_id}.${time}`

      const contact = {
        scene: 'group' as 'group',
        peer: user_id,
        sub_peer: user_id,
      }

      const sender = {
        uid: user_id,
        uin: user_id,
        nick: '',
        role: 'unknown' as Role,
      }

      switch (data.sub_type) {
        case 'increase': {
          // todo kritor没有这个事件
          this.logger('info', `[好友添加]：${JSON.stringify(data)}`)
          return
        }
        case 'decrease': {
          // todo kritor没有这个事件
          this.logger('info', `[好友添减少]：${JSON.stringify(data)}`)
          return
        }
        case 'poke': {
          const operator_id = data.operator_id + ''
          const target_id = data.target_id + ''
          const content = {
            operator_uid: operator_id,
            operator_uin: operator_id,
            target_uid: target_id,
            target_uin: target_id,
            action: data.action,
            suffix: data.suffix,
            action_image: '',
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: 'private_poke' as 'private_poke',
          }
          notice = new KarinNotice(options)
          break
        }
        case 'recall': {
          const content = {
            operator_uid: user_id,
            operator_uin: user_id,
            message_id: data.message_id,
            tip_text: '撤回了一条消息',
          }

          const options = {
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: 'private_recall' as 'private_recall',
          }
          notice = new KarinNotice(options)
          break
        }
      }

      listener.emit('notice', notice)
    })

    /** 遇到滑动验证码(滑块) */
    this.super.on('system.login.slider', event => slider(event.url, this))

    /** 遇到短信验证码(包含真假设备锁) */
    this.super.on('system.login.device', event => device(event, this))

    /** 遇到登录错误的信息 */
    this.super.on('system.login.error', event => {
      this.logger('error', `[登录错误] 错误代码: ${event.code}`)
      this.logger('error', `[登录失败] 错误信息: ${event.message}`)
    })

    await this.super.login(bot.qq, bot.password)
  }

  get self_id () {
    return this.account.uid
  }

  /**
   * icqq转karin
   * @return karin格式消息
   * */
  async AdapterConvertKarin (data: Array<MessageElem>): Promise<Array<KarinElement>> {
    const elements = []
    for (const i of data) {
      switch (i.type) {
        case 'text':
          elements.push(segment.text(i.text))
          break
        case 'face':
          elements.push(segment.face(i.id))
          break
        case 'image':
          elements.push(segment.image(i.url || i.file.toString(), { file_type: undefined }))
          break
        case 'record':
          elements.push(segment.record(i.url || i.file.toString(), false))
          break
        case 'video': {
          const url = await this.super.getVideoUrl(i.fid as string, i.md5 as string)
          elements.push(segment.video(url, i.md5 as string, i.name || ''))
          break
        }
        case 'at': {
          const qq = String(i.qq)
          elements.push(segment.at(qq, qq, i.text))
          break
        }
        case 'poke':
          elements.push(segment.poke(i.id, 0))
          break
        case 'location':
          elements.push(segment.location(i.lat, i.lng, i.name || '', i.address || ''))
          break
        case 'reply':
          elements.push(segment.reply(i.id))
          break
        case 'json':
          elements.push(segment.json(i.data.data))
          break
        case 'xml':
          elements.push(segment.xml(i.data))
          break
        case 'long_msg': {
          elements.push(segment.long_msg(i.resid))
          break
        }
        default: {
          elements.push(segment.text(JSON.stringify(i)))
        }
      }
    }
    return elements
  }

  /**
   * karin转icqq
   * @param data karin格式消息
   * */
  async KarinConvertAdapter (data: Array<KarinElement>): Promise<Array<MessageElem>> {
    const elements: Array<MessageElem> = []

    for (const i of data) {
      switch (i.type) {
        case 'text':
          elements.push(Segment.text(i.text))
          break
        case 'face':
          elements.push(Segment.face(i.id))
          break
        case 'at':
          elements.push(Segment.at(Number(i.uid), i.name))
          break
        case 'reply':
          // icqq没有制作回复的api
          elements.push({ type: 'reply', id: i.message_id })
          break
        case 'image': {
          elements.push(Segment.image(i.file))
          break
        }
        case 'video': {
          elements.push(Segment.video(i.file))
          break
        }
        case 'file': {
          // 不支持通过这里发送文件
          break
        }
        case 'xml': {
          elements.push(Segment.xml(i.data))
          break
        }
        case 'json': {
          elements.push(Segment.json(i.data))
          break
        }
        case 'forward': {
          // 换专门api发送
          // elements.push({ type: 'forward', data: { id: i.res_id } })
          break
        }
        case 'record':
        case 'voice': {
          elements.push(Segment.record(i.file))
          // elements.push({ type: 'record', data: { file: i.file, magic: i.magic || false } })
          break
        }
        case 'music': {
          if (i.id) {
            const typeMap = {
              QQ: 'qq' as 'qq',
              netease: '163' as '163',
              custom: 'migu' as 'migu', // 随便给个值...这里不能传这个类型
            }
            elements.push(await Segment.music(i.id, typeMap[i.platform]))
          } else {
            // 这里应该修改为高清语音
            // const { url, audio, title, author, pic } = i as unknown as CustomMusicElemen
            // elements.push({ type: 'music', data: { type: 'custom', url, audio, title, content: author, image: pic } })
          }
          break
        }
        case 'markdown': {
          elements.push(Segment.markdown(i.content, i.config))
          break
        }
        case 'poke': {
          elements.push(Segment.poke(i.id))
          break
        }
        case 'location': {
          elements.push(Segment.location(i.lat, i.lon, i.title, i.address))
          break
        }
        case 'long_msg': {
          elements.push(Segment.long_msg(i.id))
          break
        }
        case 'dice': {
          elements.push(Segment.dice(i.id))
          break
        }
        case 'rps': {
          elements.push({ type: i.type, id: i.id })
          break
        }
        case 'share': {
          elements.push(Segment.share(i.url, i.title, i.content, i.image))
          break
        }
        case 'button':
        case 'rows':
        case 'bubble_face':
        case 'contact':
        case 'gift':
        case 'weather':
        case 'basketball':
        case 'market_face':
        default: {
          elements.push(Segment.text(JSON.stringify(i)))
          break
        }
      }
    }
    return elements as Array<MessageElem>
  }

  logger (level: 'info' | 'error' | 'trace' | 'debug' | 'mark' | 'warn' | 'fatal', ...args: any[]) {
    logger.bot(level, this.account.uid || this.account.uin, ...args)
  }

  async GetVersion () {
    const data = this.version
    delete (data as { name?: string }).name
    return data
  }

  async SendMessage (contact: contact, elements: Array<KarinElement>) {
    const message = await this.KarinConvertAdapter(elements)
    if (contact.scene === 'friend') {
      return await this.super.pickUser(Number(contact.peer)).sendMsg(message)
    }
    return await this.super.pickGroup(Number(contact.peer)).sendMsg(message)
  }

  /**
   * 获取头像url
   * @param size 头像大小，默认`0`
   * @returns 头像的url地址
   */
  getAvatarUrl (user_id: string, size: 0 | 40 | 100 | 140 = 0) {
    return `https://q1.qlogo.cn/g?b=qq&s=${size}&nk=` + user_id
  }

  /**
   * 获取群头像url
   * @param size 头像大小，默认`0`
   * @param history 历史头像记录，默认`0`，若要获取历史群头像则填写1,2,3...
   * @returns 头像的url地址
   */
  getGroupAvatar (group_id: string, size: 0 | 40 | 100 | 140 = 0, history = 0) {
    return `https://p.qlogo.cn/gh/${group_id}/${group_id}${history ? '_' + history : ''}/` + size
  }

  async GetCurrentAccount () {
    return { account_uid: this.account.uid, account_uin: this.account.uin, account_name: this.super.nickname }
  }

  async RecallMessage (contact: contact, message_id: string) {
    if (contact.scene === 'friend') {
      return await this.super.pickUser(Number(contact.peer)).recallMsg(message_id)
    }
    return await this.super.pickGroup(Number(contact.peer)).recallMsg(message_id)
  }

  async ReactMessageWithEmoji (contact: contact, message_id: string, face_id: number, is_set: boolean) {
    const { seq } = parseGroupMessageId(message_id)
    return await this.super.pickGroup(Number(contact.peer)).setReaction(seq, face_id + '')
  }

  async VoteUser (target_uid_or_uin: string, vote_count: number) {
    return await this.super.pickUser(Number(target_uid_or_uin)).thumbUp(vote_count)
  }

  async sendForwardMessage (contact: contact, elements: KarinNodeElement[]) {
    const userId = Number(this.account.uid)
    const nickName = this.account.name
    const messages = []

    for (const v of elements) {
      const user_id = Number(v.user_id) || userId
      const nickname = v.nickname || nickName
      const content = Array.isArray(v.content) ? v.content : [v.content]
      const message = await this.KarinConvertAdapter(content)
      messages.push(Segment.fake(user_id, message, nickname))
    }

    if (contact.scene === 'friend') {
      const res = await this.super.makeForwardMsg(messages, true)
      return await this.super.pickUser(Number(contact.peer)).sendMsg(res)
    } else {
      const res = await this.super.makeForwardMsg(messages, false)
      return await this.super.pickGroup(Number(contact.peer)).sendMsg(res)
    }
  }

  async UploadForwardMessage (): Promise<any> { throw new Error('Method not implemented.') }

  async GetMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async GetEssenceMessageList (): Promise<any> { throw new Error('Method not implemented.') }
  async DownloadForwardMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async SetEssenceMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async DeleteEssenceMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async SetFriendApplyResult (): Promise<any> { throw new Error('Method not implemented.') }
  async SetGroupApplyResult (): Promise<any> { throw new Error('Method not implemented.') }
  async SetInvitedJoinGroupResult (): Promise<any> { throw new Error('Method not implemented.') }
  async UploadPrivateFile (): Promise<any> { throw new Error('Method not implemented.') }
  async UploadGroupFile (): Promise<any> { throw new Error('Method not implemented.') }
  async SendMessageByResId (): Promise<any> { throw new Error('Method not implemented.') }
  async GetHistoryMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async KickMember (): Promise<any> { throw new Error('Method not implemented.') }
  async BanMember (): Promise<any> { throw new Error('Method not implemented.') }
  async SetGroupWholeBan (): Promise<any> { throw new Error('Method not implemented.') }
  async SetGroupAdmin (): Promise<any> { throw new Error('Method not implemented.') }
  async ModifyMemberCard (): Promise<any> { throw new Error('Method not implemented.') }
  async ModifyGroupName (): Promise<any> { throw new Error('Method not implemented.') }
  async LeaveGroup (): Promise<any> { throw new Error('Method not implemented.') }
  async SetGroupUniqueTitle (): Promise<any> { throw new Error('Method not implemented.') }
  async GetStrangerProfileCard (): Promise<any> { throw new Error('Method not implemented.') }
  async GetFriendList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupInfo (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupMemberInfo (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupMemberList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupHonor (): Promise<any> { throw new Error('Method not implemented.') }
}
