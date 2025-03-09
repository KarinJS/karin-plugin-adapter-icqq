import type { Message } from 'node-karin'

/** 事件传递的参数类型 */
export interface VerifyOptions {
  /** 触发内容 如果没有请传递空字符串 */
  msg: string
  /** 触发事件的e */
  e: Message
}
