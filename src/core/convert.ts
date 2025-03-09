import { MessageElem, segment as Segment } from 'icqq'
import { Elements, segment, SendElement } from 'node-karin'
import { AdapterICQQ } from './index'

/**
 * icqq转Karin
 * @returns Karin格式消息
 */
export async function AdapterConvertKarin (bot: AdapterICQQ, data: Array<MessageElem> = []): Promise<Array<Elements>> {
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
        elements.push(segment.image(i.url || i.file.toString()))
        break
      case 'record':
        elements.push(segment.record(i.url || i.file.toString(), false))
        break
      case 'video': {
        const url = (await bot.super.getVideoUrl(i.fid as string, i.md5 as string)) || ''
        elements.push(segment.video(url))
        break
      }

      case 'at': {
        const qq = String(i.qq)
        elements.push(segment.at(qq, i.text))
        break
      }
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
        elements.push(segment.longMsg(i.resid))
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
 * Karin转icqq
 * @param data Karin格式消息
 */
export const KarinConvertAdapter = async (bot: AdapterICQQ, data: Array<SendElement>): Promise<Array<MessageElem>> => {
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
        elements.push(Segment.at(Number(i.targetId), i.name))
        break
      case 'reply':
        // icqq没有制作回复的api
        elements.push({ type: 'reply', id: i.messageId })
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
      case 'record': {
        elements.push(Segment.record(i.file))
        // elements.push({ type: 'record', data: { file: i.file, magic: i.magic || false } })
        break
      }
      case 'music': {
        if (i.platform === 'custom') {
          // ICQQ不支持custom
        } else {
          elements.push(await Segment.music(i.id, i.platform))
        }
        break
      }
      case 'markdown': {
        elements.push(Segment.markdown(i.markdown, i.config))
        break
      }
      case 'location': {
        elements.push(Segment.location(i.lat, i.lon, i.title, i.address))
        break
      }
      case 'longMsg': {
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
      case 'raw': {
        elements.push(i.data)
        break
      }
      case 'button':
      case 'keyboard':
      case 'contact':
      case 'gift':
      case 'weather':
      case 'basketball':
      default: {
        elements.push(Segment.text(JSON.stringify(i)))
        break
      }
    }
  }
  return elements as Array<MessageElem>
}
