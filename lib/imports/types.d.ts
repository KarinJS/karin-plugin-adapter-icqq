export interface CfgType {
    /** QQ号 */
    qq: number;
    /** 密码 */
    password: string;
    cfg: {
        /**
         * 协议类型
         * - 1: 安卓手机
         * - 2: 安卓平板
         * - 3: 安卓手表
         * - 4: MacOS
         * - 5: iPad
         * - 6: Tim
         */
        platform: 1 | 2 | 3 | 4 | 5 | 6;
        /** 协议版本 不填默认最新 */
        ver: string;
        /** 群聊和频道中过滤自己的消息 */
        ignore_self: boolean;
        /** 签名服务器地址 不设置将使用默认地址 */
        sign_api_addr: string;
        /** 是否缓存群员列表，群多的时候(500~1000)会多占据约100MB + 内存 */
        cache_group_member: boolean;
        log_level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'mark' | 'off';
        /** 数据存储文件夹，需要可写权限，默认主模块下的data文件夹 */
        data_dir?: string;
        /** ffmpeg */
        ffmpeg_path?: string;
        ffprobe_path?: string;
    };
}
export interface ConfigType {
    /** 通用签名服务器地址 */
    sign_api_addr: string;
    /** bot配置列表 */
    list: CfgType[];
}
