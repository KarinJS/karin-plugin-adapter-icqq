# icqq 适配器

## 克隆仓库

karin根目录执行以下命令克隆仓库到本地

```bash
git clone https://github.com/karinjs/karin-plugin-adapter-icqq.git ./plugins/karin-plugin-adapter-icqq
```

## 配置token

> [!IMPORTANT]
> 请自行获取token 无token需继续使用 请参考下方降级

在 `./plugins/karin-plugin-adapter-icqq`下创建`.npmrc`，填入

```txt
@icqqjs:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=更改为你的token

```

## 安装依赖

```bash
pnpm install --filter=karin-plugin-adapter-icqq
```

## 配置

> 目前暂时只支持手动配置

推荐先运行一次 生成配置文件夹

```bash
node .
```

打开 `config/plugin/karin-plugin-adapter-icqq` 文件夹，创建`config.yaml`文件，填入以下内容

```yaml
# 默认签名服务器地址
sign_api_addr: sign地址

list:
  - qq: QQ号
    password: 密码
    cfg:
      # 登录设备平台 1:安卓手机、 2:安卓平板 、 3:安卓手表、 4:MacOS 、 5:iPad 、 6:Tim
      platform: 2
      # 协议版本 不填默认最新
      ver: ""
      # 群聊和频道中过滤自己的消息
      ignore_self: true
      # 签名服务器地址 不设置将使用默认地址
      sign_api_addr: ""
      # 是否缓存群员列表，群多的时候(500~1000)会多占据约100MB+内存
      cache_group_member: true
  - qq: QQ号2
    password: QQ密码2
    cfg:
      # 登录设备平台 1:安卓手机、 2:安卓平板 、 3:安卓手表、 4:MacOS 、 5:iPad 、 6:Tim
      platform: 2
      # 协议版本 不填默认最新
      ver: ""
      # 群聊和频道中过滤自己的消息
      ignore_self: true
      # 签名服务器地址 不设置将使用默认地址
      sign_api_addr: ""
      # 是否缓存群员列表，群多的时候(500~1000)会多占据约100MB+内存
      cache_group_member: true

```

只需要一个删除第二个即可。

## 降级

打开`plugins\karin-plugin-adapter-icqq`，执行

```bash
pnpm add icqq -w
```

打开`plugins\karin-plugin-adapter-icqq\lib\core\index.js`  

修改前:

```js
import { slider, device } from './login.js'
import { Client, segment as Segment, parseGroupMessageId } from '@icqqjs/icqq' // 修改这里
import { listener, KarinMessage, logger, segment, KarinNotice } from 'node-karin'
```

修改后:

```js
import { slider, device } from './login.js'
import { Client, segment as Segment, parseGroupMessageId } from 'icqq' // 修改这里
import { listener, KarinMessage, logger, segment, KarinNotice } from 'node-karin'
```

## 鸣谢

感谢`hlhs`提供的自动过滑块~
