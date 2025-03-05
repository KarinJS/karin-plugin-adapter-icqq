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
})
