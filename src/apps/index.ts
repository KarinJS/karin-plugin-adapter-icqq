import karin from 'node-karin'

export const verify = karin.command(/^#qq验证.+:.+$/i, async (e) => {
  const msg = e.msg.replace(/^#qq验证/i, '').trim().split(':')
  const data = {
    msg: msg[1],
    selfId: msg[0],
    reply: (msg: string) => e.reply(msg, { at: true }),
    e
  }
  karin.emit(`ICQQLogin.${data.selfId}`, data)
}, { name: 'ICQQ验证', perm: 'master', priority: -1 })

export const OnlineOffline = karin.command(/^#qq(上|下)线.+$/i, async (e) => {
  const id = e.msg.replace(/^#qq(上|下)线/i, '').trim()
  if (!id) return false
  if (e.msg.includes('下')) {
    const bot = karin.getBot(id)
    if (!bot) return false
    bot.super.logout()
    return e.reply(`[${id} 下线成功]`)
  }
}, { name: 'ICQQ上线下线', perm: 'master', priority: -1 })
