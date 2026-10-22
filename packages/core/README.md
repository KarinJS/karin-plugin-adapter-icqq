# @karinjs/adapter-icqq

Karin 的 icqq 适配器，附带账号管理页面。

## 安装

```bash
pnpm add icqq@npm:@icqqjs/icqq -w
pnpm add @karinjs/adapter-icqq -w
```

安装依赖前请按主仓库 README 配置 `@icqqjs` 的 GitHub Packages 登录。

## 账号管理

重启 Karin 后，在 Karin WebUI 的插件配置中打开「ICQQ 账号管理」，或直接访问：

```text
http://127.0.0.1:7777/icqq/web
```

页面支持账号增删改查、启用/停用、上线/下线、全局签名服务器、人工过码服务、登录平台、协议版本、日志等级等配置。

登录遇到滑动验证、安全验证或短信验证时，账号会显示「待验证」，点击「验证」手动打开验证窗口（不会自动弹窗）；登录失败后账号会回到「异常」并保留错误原因。短信验证（登录保护）的官方链接不在过码服务支持范围内，弹窗会直接提供短信验证码的发送 / 提交入口和官方验证页面链接。过码服务地址默认 `https://icqq.qwqo.cn`，仅支持兼容其 API 的 `http(s)` 根地址，便于使用官方公开仓库自建服务。

> 扫码登录仅 MacOS / 安卓手表协议支持；密码为空且协议不支持扫码时，保存会提示填写密码，账号启动时也会直接提示原因。

- 页面接口：`/icqq/api/v1`
- 页面入口：`/icqq/web`
- 配置文件：`@karinjs/@karinjs-adapter-icqq/config/config.json`

> 自定义插件配置页面需要 Karin >= 1.18。

完整文档与开发说明请见 [主仓库](https://github.com/KarinJS/karin-plugin-adapter-icqq)。
