import { slider, device } from './login'
import { CfgType } from '../imports/types'
import { Client, MessageElem, segment as Segment, parseGroupMessageId, genGroupMessageId, genDmMessageId, axios } from '@icqqjs/icqq'
import { listener, KarinMessage, KarinAdapter, Contact, KarinElement, logger, segment, Role, KarinNotice, NoticeType, NodeElement, MessageSubType, EventType, Scene, NoticeSubType, GroupMemberInfo, GroupInfo, PushMessageBody, FriendInfo, GroupHonorInfo, EssenceMessageBody, GetRemainCountAtAllResponse } from 'node-karin'
import { parseGroupRequestFlag } from '@icqqjs/icqq/lib/internal'
import { uuid } from '@icqqjs/icqq/lib/common'

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

      /** 引用回复 */
      if (data.source) {
        /** 构建message_id */
        let message_id = ''
        if (data.message_type === 'group') {
          message_id = genGroupMessageId(data.group_id, data.source.user_id, data.source.seq, data.rand, data.source.time)
        } else {
          message_id = genDmMessageId(data.source.user_id, data.source.seq, data.rand, data.source.time)
        }

        elements.unshift(segment.reply(message_id))
      }

      const message = {
        event: EventType.Message as EventType.Message,
        raw_event: data,
        sub_event: data.sub_type === 'group' ? MessageSubType.GroupMessage : MessageSubType.PrivateMessage,
        event_id: data.message_id + '',
        self_id: this.account.uid + '',
        user_id: data.sender.user_id + '',
        time: data.time,
        message_id: data.message_id + '',
        message_seq: data.seq,
        sender: {
          ...data.sender,
          uid: data.sender.user_id + '',
          uin: data.sender.user_id + '',
          nick: data.sender.nickname || '',
          role: 'role' in data.sender ? data.sender.role as Role || Role.Unknown : Role.Unknown,
        },
        elements,
        contact: {
          scene: data.message_type === 'private' ? Scene.Private : Scene.Group,
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
        scene: Scene.Group,
        peer: group_id,
        sub_peer: group_id,
      }

      const sender = {
        uid: user_id,
        uin: user_id,
        nick: '',
        role: Role.Unknown,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: NoticeSubType.GroupSignIn,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: NoticeSubType.GroupMemberIncrease,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: NoticeSubType.GroupMemberDecrease,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: NoticeSubType.GroupRecall,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: NoticeSubType.GroupPoke,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: NoticeSubType.GroupAdminChanged,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            group_id,
            sub_event: NoticeSubType.GroupMemberBan,
          }
          notice = new KarinNotice(options)
          break
        }
        case 'transfer': {
          logger.bot('info', '群转让事件[暂未适配]: ', JSON.stringify(data))
          return
        }
      }

      notice.bot = this
      /**
       * 快速回复 开发者不应该使用这个方法，应该使用由karin封装过后的reply方法
       */
      notice.replyCallback = async elements => {
        const message = await this.KarinConvertAdapter(elements)
        return await this.super.pickGroup(Number(contact.peer)).sendMsg(message)
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
        scene: Scene.Group,
        peer: user_id,
        sub_peer: user_id,
      }

      const sender = {
        uid: user_id,
        uin: user_id,
        nick: '',
        role: Role.Unknown,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: NoticeSubType.PrivatePoke,
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
            raw_event: data,
            time,
            self_id,
            user_id,
            event_id,
            sender,
            contact,
            content,
            sub_event: NoticeSubType.PrivateRecall,
          }
          notice = new KarinNotice(options)
          break
        }
      }

      notice.bot = this
      /**
       * 快速回复 开发者不应该使用这个方法，应该使用由karin封装过后的reply方法
       */
      notice.replyCallback = async elements => {
        const message = await this.KarinConvertAdapter(elements)
        return await this.super.pickFriend(Number(contact.peer)).sendMsg(message)
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
          elements.push(segment.json(i.data))
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

  async SendMessage (contact: Contact, elements: Array<KarinElement>) {
    const message = await this.KarinConvertAdapter(elements)
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

  async RecallMessage (contact: Contact, message_id: string) {
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

  async sendForwardMessage (contact: Contact, elements: NodeElement[]) {
    const userId = Number(this.account.uid)
    const nickName = this.account.name
    const messages = []

    for (const v of elements) {
      const user_id = Number(v.user_id) || userId
      const nickname = v.nickname || nickName
      const content = (Array.isArray(v.content) ? v.content : [v.content]) as KarinElement[]
      const message = await this.KarinConvertAdapter(content)
      messages.push(Segment.fake(user_id, message, nickname))
    }

    if (contact.scene === Scene.Private) {
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

  async GetMessage (contact: Contact, messageId: string) {
    const res = await this.super.getMsg(messageId)
    if (!res) throw TypeError('消息不存在')
    const elements = await this.AdapterConvertKarin(res.message)
    return {
      contact,
      elements,
      time: res.time,
      message_seq: res.seq,
      message_id: messageId,
      user_id: res.sender.user_id + '',
      sender: {
        uid: res.sender.user_id + '',
        uin: res.sender.user_id + '',
        nick: res.sender.nickname || '',
        role: 'role' in res.sender ? res.sender.role as Role || Role.Unknown : Role.Unknown,
      },
    }
  }

  async UploadForwardMessage (contact: Contact, elements: Array<NodeElement>) {
    const userId = Number(this.account.uid)
    const nickName = this.account.name
    const messages = []

    for (const v of elements) {
      const user_id = Number(v.user_id) || userId
      const nickname = v.nickname || nickName
      const content = (Array.isArray(v.content) ? v.content : [v.content]) as KarinElement[]
      const message = await this.KarinConvertAdapter(content)
      messages.push(Segment.fake(user_id, message, nickname))
    }

    if (contact.scene === Scene.Private) {
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

  async GetGroupMemberInfo (group_id: string, target_uid_or_uin: string, refresh?: boolean): Promise<GroupMemberInfo> {
    const result = await this.super.getGroupMemberInfo(Number(group_id), Number(target_uid_or_uin), refresh)
    return {
      uid: target_uid_or_uin,
      uin: target_uid_or_uin,
      nick: result.nickname || '',
      age: result.age || 0,
      unique_title: result.title || '',
      unique_title_expire_time: result.title_expire_time || 0,
      card: result.card || '',
      join_time: result.join_time || 0,
      last_active_time: result.update_time || 0,
      level: result.level || 0,
      shut_up_time: result.shutup_time || 0,
      distance: 0,
      honors: [],
      unfriendly: !!this.super.fl.get(Number(target_uid_or_uin)),
      card_changeable: undefined,
      role: result.role as Role,
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

    await Promise.all(result.map(async v => {
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
          sub_peer: '',
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

  async SendMessageByResId (contact: Contact, res_id: string): Promise<{ message_id: string, message_time: number }> {
    const isPrivate = contact.scene === Scene.Private
    const isNewVersion = this.version.name === '@icqqjs/icqq'

    const sendMsg = async (peerId: number, msg: any) => {
      const sendMethod = isPrivate ? this.super.pickFriend(peerId) : this.super.pickGroup(peerId)
      const res = await sendMethod.sendMsg(msg)
      return { message_id: res.message_id, message_time: res.time }
    }

    if (isNewVersion) {
      /** 新版本走长消息发送 */
      const msg = { type: 'long_msg', resid: res_id }
      return sendMsg(Number(contact.peer), msg)
    }

    /** 旧版本重新构建json发送 */
    const result = await this.super.getForwardMsg(res_id)
    const json = {
      app: 'com.tencent.multimsg',
      config: { autosize: 1, forward: 1, round: 1, type: 'normal', width: 300 },
      desc: '[聊天记录]',
      extra: '',
      meta: {
        detail: {
          news: [{ text: `${result[0].nickname}: 点击查看` }],
          resid: res_id,
          source: '群聊的聊天记录',
          summary: `查看${result.length}条转发消息`,
          uniseq: uuid().toUpperCase(),
        },
      },
      prompt: '[聊天记录]',
      ver: '0.0.0.5',
      view: 'contact',
    }
    return sendMsg(Number(contact.peer), Segment.json(json))
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

  async GetHistoryMessage (contact: Contact, start_message_id: string, count: number = 20): Promise<Array<PushMessageBody>> {
    const list: Array<PushMessageBody> = []
    const result = await this.super.getChatHistory(start_message_id, count)
    for (const v of result) {
      const elements = await this.AdapterConvertKarin(v.message)
      list.push({
        elements,
        time: v.time,
        message_id: v.message_id,
        message_seq: v.seq,
        sender: {
          uid: v.sender.user_id + '',
          uin: v.sender.user_id + '',
          nick: v.sender.nickname || '',
          role: Role.Unknown,
        },
        contact: {
          scene: contact.scene,
          peer: contact.scene === Scene.Private ? v.sender.user_id + '' : contact.peer,
          sub_peer: '',
        },
      })
    }

    return list
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

  async GetEssenceMessageList (group_id: string, page: number, page_size: number): Promise<Array<EssenceMessageBody>> {
    const list: Array<EssenceMessageBody> = []

    /** 扒出来一个奇怪的接口。。。 */
    const url = `https://qun.qq.com/essence/indexPc?gc=${group_id}`

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) QQ/9.6.5.28778 Chrome/43.0.2357.134 Safari/537.36 QBCore/3.43.1298.400 QQBrowser/9.0.2524.400',
      Host: 'qun.qq.com',
      Cookie: this.super.cookies['qun.qq.com'],
    }

    const result = await axios.get(url, { headers })
    const text = result.data.match(/<script>window\.__INITIAL_STATE__=(\{.*?\})<\/script>/)[1].replace(/\\/g, '\\\\')
    const data = JSON.parse(text)

    for (const v of data.msgList) {
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
        message_id: '',
        message_seq: 0,
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
