export const ICQQ = 'ICQQLogin'

/**
 * 获取icqq监听事件key
 * @param qq - QQ号
 */
export const getIcqqLoginKey = (qq: number | string) => {
  return `${ICQQ}:${qq}`
}
