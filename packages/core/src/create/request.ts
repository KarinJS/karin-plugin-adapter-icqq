import { FriendRequestEvent, GroupInviteEvent, GroupRequestEvent } from 'icqq'
import { contactFriend, contactGroup, createGroupApplyRequest, createGroupInviteRequest, createPrivateApplyRequest, logger, senderFriend, senderGroup } from 'node-karin'
import { AdapterICQQ } from '@/core'

/**
 * 创建请求事件
 * @param event - 请求事件
 * @param bot - Bot实例
 */
export const createRequest = (event:
    | FriendRequestEvent
    | GroupInviteEvent
    | GroupRequestEvent, bot: AdapterICQQ) => {
  const time = event.time
  const userId = String(event.user_id)
  // 新好友申请
  if (event.request_type === 'friend') {
    const contact = contactFriend(userId)
    createPrivateApplyRequest({
      bot,
      time,
      contact,
      rawEvent: event,
      subEvent: 'friendApply',
      eventId: `request:${event.flag}`,
      sender: senderFriend(userId, ''),
      srcReply: (elements) => bot.sendMsg(contact, elements),
      content: {
        applierId: userId,
        message: event.comment,
        flag: event.flag
      }
    })
    return true
  }
  if (event.request_type === 'group') {
    const groupId = String(event.group_id)
    const contact = contactGroup(groupId)
    // 加群申请
    if (event.sub_type === 'add') {
      createGroupApplyRequest({
        bot,
        time,
        contact,
        rawEvent: event,
        subEvent: 'groupApply',
        eventId: `request:${event.flag}`,
        sender: senderGroup(userId, 'member'),
        srcReply: (elements) => bot.sendMsg(contact, elements),
        content: {
          applierId: userId,
          inviterId: !event.inviter_id ? '' : String(event.inviter_id),
          reason: event.tips,
          flag: event.flag,
          groupId
        }
      })
      return true
    } else
    // 邀请Bot加群
      if (event.sub_type === 'invite') {
        createGroupInviteRequest({
          bot,
          time,
          contact,
          rawEvent: event,
          subEvent: 'groupInvite',
          eventId: `request:${event.flag}`,
          sender: senderGroup(userId, 'member'),
          srcReply: (elements) => bot.sendMsg(contact, elements),
          content: {
            inviterId: userId,
            flag: event.flag,
          }
        })
        return true
      }
  }
  logger.warn(`[AdapterICQQ] 收到未知事件: ${JSON.stringify(event)}`)
}
