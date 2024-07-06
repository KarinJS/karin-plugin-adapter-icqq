import { AdapterICQQ } from './index.js';
/**
 * 处理滑块验证码
 */
export declare function slider(url: string, adapter: AdapterICQQ): Promise<void>;
/**
 * 自动过滑块
 * 由hlhs授权提供，感谢大佬的支持~ https://gitee.com/Mozz2020
 */
export declare function autoSlider(uid: string, url: string): Promise<string>;
/**
 * 手动过滑块
 */
export declare function manualSlider(uid: string, url: string): Promise<string>;
/**
 * 处理设备锁
 */
export declare function device(event: {
    url: string;
    phone: string;
}, adapter: AdapterICQQ): Promise<void>;
