# icqq 适配器

## 安装插件

1. 在你的项目根目录新建文件 `.npmrc` ，并录入以下内容

```text
@icqqjs:registry=https://npm.pkg.github.com
```

2. 登录账户

在karin根目录执行以下命令，按照提示进行操作

```bash
npm login --scope=@icqqjs --auth-type=legacy --registry=https://npm.pkg.github.com

# 回车，根据提示登录github

UserName: # 你的github账号 请填写小写
Password: # 前往 https://github.com/settings/tokens/new  获取，scopes勾选 read:packages
E-Mail: # 你的公开邮箱地址
```

3. 安装插件

```bash
pnpm add @karinjs/adapter-icqq -w
```

## 配置

配置文件参考
配置文件目录 `@karinjs/@karinjs-adapter-icqq/config/config.json`

```json
{
  "sign_api_addr": "签名地址", // 默认签名地址
  "list": [
    {
      "enable": true, // 是否启用该账号
      "qq": 114514, // QQ账号
      "password": "114514", // QQ密码，为空则扫码登录
      "cfg": {
        "platform": 2, // 登录设备平台 1:安卓手机、 2:安卓平板 、 3:安卓手表、 4:MacOS 、 5:iPad 、 6:Tim
        "ver": "", // 协议版本 不填默认最新
        "sign_api_addr": "", // 签名服务器地址 不设置将使用默认地址
        "ignore_self": true, // 群聊和频道中过滤自己的消息
        "cache_group_member": true // 是否缓存群员列表，群多的时候(500~1000)会多占据约100MB+内存
      }
    },
    {
      "qq": 1111, // QQ账号2
      "password": "11111", // QQ密码2，为空则扫码登录
      "cfg": {
        "platform": 2, // 登录设备平台 1:安卓手机、 2:安卓平板 、 3:安卓手表、 4:MacOS 、 5:iPad 、 6:Tim
        "ver": "", // 协议版本 不填默认最新
        "sign_api_addr": "", // 签名服务器地址 不设置将使用默认地址
        "ignore_self": true, // 群聊和频道中过滤自己的消息
        "cache_group_member": true // 是否缓存群员列表，群多的时候(500~1000)会多占据约100MB+内存
      }
    }
  ]
}

```

## 鸣谢

感谢`hlhs`提供的自动过滑块~
