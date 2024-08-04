import { slider, device } from './login'
import { CfgType } from '../imports/types'
import { Client, MessageElem, segment as Segment, parseGroupMessageId, genGroupMessageId, genDmMessageId } from '@icqqjs/icqq'
import { listener, KarinMessage, KarinAdapter, Contact, KarinElement, logger, segment, Role, KarinNotice, NoticeType, NodeElement, MessageSubType, EventType, Scene, NoticeSubType } from 'node-karin'

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

  async GetGroupMemberInfo (group_id: string, target_uid_or_uin: string, refresh?: boolean) {
    const result = this.super.pickMember(Number(group_id), Number(target_uid_or_uin), refresh)
    return {
      uid: target_uid_or_uin,
      uin: target_uid_or_uin,
      nick: result.info?.nickname || '',
      age: result.info?.age || 0,
      unique_title: result.title || '',
      unique_title_expire_time: result.info?.title_expire_time || 0,
      card: result.card || '',
      join_time: result.info?.join_time || 0,
      last_active_time: result.info?.update_time || 0,
      level: result.info?.level || 0,
      shut_up_time: result.info?.shutup_time || 0,
      distance: 0,
      honors: [],
      unfriendly: result.is_friend,
      card_changeable: undefined,
      role: result.info?.role as Role,
    }
  }

  async GetEssenceMessageList (): Promise<any> { throw new Error('Method not implemented.') }
  async DownloadForwardMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async SetFriendApplyResult (): Promise<any> { throw new Error('Method not implemented.') }
  async SetGroupApplyResult (): Promise<any> { throw new Error('Method not implemented.') }
  async SetInvitedJoinGroupResult (): Promise<any> { throw new Error('Method not implemented.') }
  async SendMessageByResId (): Promise<any> { throw new Error('Method not implemented.') }
  async GetHistoryMessage (): Promise<any> { throw new Error('Method not implemented.') }
  async GetStrangerProfileCard (): Promise<any> { throw new Error('Method not implemented.') }
  async GetFriendList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupInfo (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetGroupHonor (): Promise<any> { throw new Error('Method not implemented.') }

  // 以下方法暂不打算实现
  async UploadFile (): Promise<any> { throw new Error('Method not implemented.') }
  async DownloadFile (): Promise<any> { throw new Error('Method not implemented.') }
  async CreateFolder (): Promise<any> { throw new Error('Method not implemented.') }
  async RenameFolder (): Promise<any> { throw new Error('Method not implemented.') }
  async DeleteFolder (): Promise<any> { throw new Error('Method not implemented.') }
  async DeleteFile (): Promise<any> { throw new Error('Method not implemented.') }
  async GetFileList (): Promise<any> { throw new Error('Method not implemented.') }
  async GetFileSystemInfo (): Promise<any> { throw new Error('Method not implemented.') }
  async ModifyGroupRemark (): Promise<any> { throw new Error('Method not implemented.') }
  async GetRemainCountAtAll (): Promise<any> { throw new Error('Method not implemented.') }
  async GetProhibitedUserList (): Promise<any> { throw new Error('Method not implemented.') }
  async SetMessageReaded (): Promise<any> { throw new Error('Method not implemented.') }
}
