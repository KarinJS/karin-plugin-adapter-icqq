# icqq 适配器

Karin 的 icqq 适配器，附带独立的账号管理页面。

## 安装插件

1. 在你的项目根目录新建文件 `.npmrc` ，并录入以下内容

```text
@icqqjs:registry=https://npm.pkg.github.com
```

2. 登录账户

在 karin 根目录执行以下命令，按照提示进行操作

```bash
npm login --scope=@icqqjs --auth-type=legacy --registry=https://npm.pkg.github.com

# 回车，根据提示登录 github

UserName: # 你的 github 账号 请填写小写
Password: # 前往 https://github.com/settings/tokens/new 获取，scopes 勾选 read:packages
E-Mail: # 你的公开邮箱地址
```

3. 安装 icqq 依赖

在 Karin 根目录执行下方命令

```bash
pnpm add icqq@npm:@icqqjs/icqq -w
```

4. 安装插件

```bash
pnpm add @karinjs/adapter-icqq -w
```

> 账号管理页面使用 Karin 1.18 起提供的插件自定义 Web 配置页面能力（`web.config` 的 `page` 字段），请确保 Karin 版本不低于 1.18。

## 账号管理页面

插件安装并重启 Karin 后，在 Karin WebUI 的插件配置中打开「ICQQ 账号管理」即可进入账号管理页面，也可以直接访问：

```text
http://127.0.0.1:7777/icqq/web
```

页面能力：

- 查看账号列表、在线状态、登录方式与签名配置
- 新增 / 编辑 / 删除账号
- 启用 / 停用账号
- 手动上线 / 下线账号
- 修改全局签名服务器
- 签名服务器地址默认隐藏，点击右侧眼睛图标后才显示完整 URL，避免截图误暴露
- 配置登录平台、协议版本、日志等级、群成员缓存、ffmpeg / ffprobe 路径
- 修改后立即写入插件配置，并尽量热应用到运行中的账号

页面内的请求统一走同源接口 `/icqq/api/v1`，使用 Karin WebUI 的登录态鉴权，不会把密码返回给前端。

### 登录验证

新增或重新上线账号时，如果 QQ 返回滑动验证、安全验证或短信验证：

- 账号列表会显示「待验证」和「验证」按钮，由用户手动打开验证窗口，不会自动弹窗
- 滑动 / 安全验证直接加载验证服务页面
- 验证服务使用 [https://icqq.qwqo.cn](https://icqq.qwqo.cn)，地址可在控制台的「全局配置 → 过码服务地址」中修改
- 过码服务地址仅支持兼容 `icqq.qwqo.cn` API 的 `http(s)` 根地址，不支持子路径，便于使用官方公开仓库自建服务
- 验证结果由后端轮询并自动提交给登录流程
- 登录保护（短信验证）的官方链接不在过码服务支持范围内，弹窗会直接展示「发送验证码 / 提交验证码」入口，并提供官方验证页面链接
- 验证窗口关闭不会取消登录，账号仍会保持待验证状态
- 登录流程失败（如「QQ版本过低」）后会清理验证状态，账号显示「异常」并在 QQ 号下方保留错误原因

可选环境变量：

| 变量 | 说明 |
| --- | --- |
| `ICQQ_CAPTCHA_API_KEY` | 验证服务的创建密钥，服务端未启用时可留空 |

### API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/icqq/api/v1/accounts` | 获取账号列表与运行状态 |
| POST | `/icqq/api/v1/accounts/create` | 创建账号 |
| POST | `/icqq/api/v1/accounts/update` | 更新账号 |
| POST | `/icqq/api/v1/accounts/delete` | 删除账号 |
| POST | `/icqq/api/v1/accounts/online` | 上线账号 |
| POST | `/icqq/api/v1/accounts/offline` | 下线账号 |
| POST | `/icqq/api/v1/accounts/verification/renew` | 重新发起当前登录验证 |
| POST | `/icqq/api/v1/accounts/verification/sms/send` | 发送登录短信验证码 |
| POST | `/icqq/api/v1/accounts/verification/sms/submit` | 提交登录短信验证码 |
| POST | `/icqq/api/v1/config` | 保存全局签名服务器与过码服务地址 |

所有接口都需要在请求头中携带 Karin 的 `Authorization: Bearer <accessToken>` 与 `x-user-id`。

## 配置

配置文件目录：

```text
@karinjs/@karinjs-adapter-icqq/config/config.json
```

```json
{
  "sign_api_addr": "签名地址",
  "captcha_api": "https://icqq.qwqo.cn",
  "list": [
    {
      "enable": true,
      "qq": 114514,
      "password": "114514",
      "cfg": {
        "platform": 2,
        "ver": "",
        "sign_api_addr": "",
        "ignore_self": true,
        "cache_group_member": true,
        "log_level": "warn"
      }
    }
  ]
}
```

- `enable`：是否启用账号，默认 `true`
- `captcha_api`：人工过码服务根地址，默认 `https://icqq.qwqo.cn`，仅支持兼容其 API 的 `http(s)` 根地址
- `password`：为空则使用扫码登录；icqq 仅 MacOS / 安卓手表协议支持扫码，其他平台在保存时会提示填写密码
- `cfg.platform`：1 安卓手机、2 安卓平板、3 安卓手表、4 MacOS、5 iPad、6 Tim
- `cfg.ver`：协议版本，不填默认最新
- `cfg.sign_api_addr`：账号级签名服务器，留空跟随全局 `sign_api_addr`
- `cfg.cache_group_member`：是否缓存群员列表，群多时会额外占用约 100MB+ 内存

## 仓库结构

```
packages/
├── core/                 # 适配器核心（发布包 @karinjs/adapter-icqq）
│   ├── src/
│   │   ├── server/       # /icqq/api/v1 与 /icqq/web
│   │   └── web.config.ts # Karin 插件自定义页面入口
│   └── web/              # Web 打包产物（构建生成，不提交）
└── web/                  # 账号管理 UI（tsdown 打包到 packages/core/web）
```

> 仓库根目录是 pnpm workspace，不是可直接加载的 Karin 插件目录。本地开发时请让 Karin 加载 `packages/core`，或安装发布后的 `@karinjs/adapter-icqq`。

## 开发

前端技术栈：React 19、HeroUI v3、Tailwind CSS v4，打包工具为 tsdown。

```bash
pnpm install

# 构建 UI + 核心
pnpm build

# 仅构建 UI，产物输出到 packages/core/web
pnpm build:web

# 仅构建核心，产物输出到 packages/core/dist
pnpm build:core

# 类型检查
pnpm typecheck
```

- UI 使用 React 19 + HeroUI v3 + Tailwind CSS v4，表单、弹窗、按钮、提示等组件统一由 HeroUI 提供
- tsdown 负责打包 React/TSX 到 `packages/core/web/assets/app.js`，Tailwind CSS CLI 生成 `packages/core/web/assets/style.css`
- `index.html` 由 `packages/web/scripts/prepare.mjs` 复制到 `packages/core/web`
- 核心与 UI 均不生成 `.d.ts` 文件

## 鸣谢

感谢 `hlhs` 提供的自动过滑块~
