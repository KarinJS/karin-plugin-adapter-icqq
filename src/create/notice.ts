import {
  MemberDecreaseEvent,
  FriendDecreaseEvent,
  FriendIncreaseEvent,
  FriendPokeEvent,
  FriendRecallEvent,
  GroupSignEvent,
  MemberIncreaseEvent,
  GroupRecallEvent,
  GroupPokeEvent,
  GroupAdminEvent,
  GroupMuteEvent,
  GroupTransferEvent,
  GroupReactionEvent
} from 'icqq/lib/events'
import { AdapterICQQ } from '@/core'
import {
  contactFriend,
  contactGroup,
  createFriendDecreaseNotice,
  createFriendIncreaseNotice,
  createGroupAdminChangedNotice,
  createGroupMemberAddNotice,
  createGroupMemberBanNotice,
  createGroupMemberDelNotice,
  createGroupMessageReactionNotice,
  createGroupPokeNotice,
  createGroupRecallNotice,
  createGroupSignInNotice,
  createPrivatePokeNotice,
  createPrivateRecallNotice,
  logger,
  senderFriend,
  senderGroup
} from 'node-karin'

/**
 * 创建通知事件
 * @param event icqq通知事件
 * @param bot icqq实例
 */
export const createNoice = (event:
  | MemberDecreaseEvent
  | MemberIncreaseEvent
  | GroupSignEvent
  | FriendPokeEvent
  | FriendRecallEvent
  | FriendIncreaseEvent
  | FriendDecreaseEvent
  | GroupRecallEvent
  | GroupAdminEvent
  | GroupPokeEvent
  | GroupTransferEvent
  | GroupReactionEvent
  | GroupMuteEvent, bot: AdapterICQQ) => {
  if (event.notice_type === 'friend') {
    // 好友增加
    if (event.sub_type === 'increase') {
      const userId = String(event.user_id)
      const contact = contactFriend(userId)
      createFriendIncreaseNotice({
        eventId: `notice:${userId}.${Date.now()}`,
        rawEvent: event,
        bot,
        time: Date.now(),
        contact,
        sender: senderFriend(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          targetId: userId,
        }
      })
      return true
    }
    // 好友减少
    if (event.sub_type === 'decrease') {
      const userId = String(event.user_id)
      const contact = contactFriend(userId)
      createFriendDecreaseNotice({
        eventId: `notice:${userId}.${Date.now()}`,
        rawEvent: event,
        bot,
        time: Date.now(),
        contact,
        sender: senderFriend(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          targetId: userId,
        }
      })
      return true
    }
    // 好友撤回
    if (event.sub_type === 'recall') {
      const userId = String(event.user_id)
      const contact = contactFriend(userId)
      createPrivateRecallNotice({
        eventId: `notice:${userId}.${event.time}`,
        rawEvent: event,
        bot,
        time: event.time,
        contact,
        sender: senderFriend(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          messageId: event.message_id,
          operatorId: userId,
          tips: ''
        }
      })
      return true
    }
    // 好友戳一戳
    if (event.sub_type === 'poke') {
      const userId = String(event.user_id)
      const contact = contactFriend(userId)
      createPrivatePokeNotice({
        eventId: `notice:${userId}.${Date.now()}`,
        rawEvent: event,
        bot,
        time: Date.now(),
        contact,
        sender: senderFriend(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          operatorId: userId,
          targetId: String(event.target_id),
          action: event.action,
          actionImage: '',
          suffix: ''
        }
      })
      return true
    }
  }
  if (event.notice_type === 'group') {
    // 群打卡
    if (event.sub_type === 'sign') {
      const groupId = String(event.group_id)
      const userId = String(event.user_id)
      const contact = contactGroup(groupId)
      createGroupSignInNotice({
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        bot,
        content: {
          targetId: userId,
          action: '',
          rankImage: ''
        }
      })
      return true
    }
    // 群成员增加
    if (event.sub_type === 'increase') {
      const userId = String(event.user_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      createGroupMemberAddNotice({
        bot,
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          operatorId: userId,
          targetId: userId,
          type: 'invite'
        }
      })
      return true
    }
    // 群消息减少
    if (event.sub_type === 'decrease') {
      const userId = String(event.user_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      let type: 'kick' | 'kickBot' | 'leave' = (bot.selfId !== String(event.operator_id) && bot.selfId === String(event.user_id)) ? 'kickBot' : 'kick'
      if (!type) type = 'leave'
      createGroupMemberDelNotice({
        bot,
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          operatorId: String(event.operator_id),
          targetId: userId,
          type
        }
      })
      return true
    }
    // 群消息撤回
    if (event.sub_type === 'recall') {
      const userId = String(event.user_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      createGroupRecallNotice({
        eventId: `notice:${event.group_id}.${event.time}`,
        rawEvent: event,
        bot,
        time: event.time,
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          messageId: event.message_id,
          operatorId: String(event.operator_id),
          targetId: userId,
          tip: ''
        }
      })
      return true
    }
    // 群戳一戳
    if (event.sub_type === 'poke') {
      const userId = String(event.target_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      createGroupPokeNotice({
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        bot,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          operatorId: String(event.operator_id),
          targetId: userId,
          action: event.action,
          actionImage: '',
          suffix: ''
        }
      })
      return true
    }
    // 群管理变动
    if (event.sub_type === 'admin') {
      const userId = String(event.user_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      createGroupAdminChangedNotice({
        bot,
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          targetId: userId,
          isAdmin: event.set,
        }
      })
      return true
    }
    if (event.sub_type === 'ban') {
      const userId = String(event.user_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      createGroupMemberBanNotice({
        bot,
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          operatorId: String(event.operator_id),
          targetId: userId,
          duration: event.duration,
          isBan: true,
        }
      })
      return true
    }
    if (event.sub_type === 'reaction') {
      const userId = String(event.user_id)
      const groupId = String(event.group_id)
      const contact = contactGroup(groupId)
      createGroupMessageReactionNotice({
        bot,
        eventId: `notice:${event.group_id}.${Date.now()}`,
        rawEvent: event,
        time: Date.now(),
        contact,
        sender: senderGroup(userId),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          count: 1,
          faceId: Number(event.id),
          isSet: event.set,
          messageId: String(event.seq)
        }
      })
      return true
    }
    // 群转让
    if (event.sub_type === 'transfer') {
      logger.bot('info', '群转让事件[暂未适配]: ', JSON.stringify(event))
    }
  }
}
