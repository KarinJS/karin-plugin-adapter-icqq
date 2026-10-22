import { defineConfig } from 'node-karin'
import { Root } from './common/Root'

export default defineConfig({
  info: {
    id: Root.pluginName,
    name: 'ICQQ 账号管理',
    author: {
      name: 'Karin',
      home: 'https://github.com/KarinJS/karin-plugin-adapter-icqq'
    },
    icon: {
      name: 'Bot',
      size: 24,
      color: '#12B7F5'
    },
    version: Root.pluginVersion,
    description: '管理 ICQQ 适配器账号、登录状态与签名服务器'
  },
  page: {
    url: '/icqq/web',
    title: 'ICQQ 账号管理',
    description: '添加、编辑、删除 ICQQ 账号，查看登录状态并管理签名服务器。'
  }
})
