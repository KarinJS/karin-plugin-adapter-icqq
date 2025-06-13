import { contactFriend, contactGroup, contactGroupTemp, createFriendMessage, createGroupMessage, createGroupTempMessage, logger, senderFriend, senderGroup } from 'node-karin'
import { AdapterConvertKarin } from '@/core/convert'
import { AdapterICQQ } from '@/core'
import { GroupMessageEvent, PrivateMessageEvent } from 'icqq'

/**
 * 创建消息事件
 * @param event - 消息事件
 * @param bot - Bot实例
 */
export const createMessage = async (event: GroupMessageEvent | PrivateMessageEvent, bot: AdapterICQQ) => {
  const time = event.time
  if (event.message_type === 'private') {
    if (event.sub_type === 'friend') {
      const userId = String(event.sender.user_id)
      const contact = contactFriend(userId)
      const sender = senderFriend(userId, event.sender.nickname)
      createFriendMessage({
        time,
        eventId: `message:${event.message_id}`,
        rawEvent: event,
        srcReply: (elements) => bot.sendMsg(contact, elements),
        bot,
        messageId: String(event.message_id),
        messageSeq: event.seq,
        elements: await AdapterConvertKarin(bot, event.message, contact, event.source),
        contact,
        sender,
      })
      return true
    }
    if (event.sub_type === 'group') {
      const groupId = String(event.sender.group_id)
      const userId = String(event.sender.user_id)
      const contact = contactGroupTemp(groupId, userId)
      const sender = senderFriend(userId, event.sender.nickname)
      createGroupTempMessage({
        time,
        eventId: `message:${event.message_id}`,
        rawEvent: event,
        srcReply: (elements) => bot.sendMsg(contact, elements),
        bot,
        messageId: String(event.message_id),
        messageSeq: event.time,
        elements: await AdapterConvertKarin(bot, event.message, contact, event.source),
        contact,
        sender,
      })
      return true
    }
    logger.warn(`[AdapterICQQ] 收到未知的私聊事件: ${JSON.stringify(event)}`)
    return true
  }
  if (event.message_type === 'group' && event.sub_type === 'normal') {
    const groupId = String(event.group_id)
    const contact = contactGroup(groupId)
    const userId = String(event.sender.user_id)
    const { nickname, role, sex, age, card, area, level, title } = event.sender
    const sender = senderGroup(userId, role, nickname, sex, age, card, area, level, title)
    createGroupMessage({
      time,
      eventId: `message:${event.message_id}`,
      rawEvent: event,
      srcReply: (elements) => bot.sendMsg(contact, elements),
      bot,
      messageId: String(event.message_id),
      messageSeq: event.time,
      elements: await AdapterConvertKarin(bot, event.message, contact, event.source),
      contact,
      sender,
    })
    return true
  }
  logger.warn(`[AdapterICQQ] 收到未知事件: ${JSON.stringify(event)}`)
  return true
}
