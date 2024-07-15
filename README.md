# icqq 适配器

## 安装插件

> [!IMPORTANT]
> 如果不知道什么是`token` 那就安装`无token`版本即可

<details>
<summary>无token版本</summary>

```bash
pnpm add karin-plugin-adapter-icqq-old -w
```

</details>

<details>
<summary>有token点击展开查看</summary>


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
pnpm add karin-plugin-adapter-icqq -w
```

</details>

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

## 鸣谢

感谢`hlhs`提供的自动过滑块~
