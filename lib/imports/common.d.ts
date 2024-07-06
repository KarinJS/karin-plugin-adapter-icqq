declare class Common {
    /**
     * 生成随机数
     * @param min - 最小值
     * @param max - 最大值
     * @returns
     */
    random(min: number, max: number): number;
    /**
     * 睡眠函数
     * @param ms - 毫秒
     */
    sleep(ms: number | undefined): Promise<unknown>;
    /**
     * 使用moment返回时间
     * @param format - 格式
     */
    time(format?: string): string;
}
export declare const common: Common;
export {};
