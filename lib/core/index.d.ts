import { CfgType } from '../imports/types.js';
import { Client, MessageElem } from '@icqqjs/icqq';
import { KarinAdapter, contact, KarinElement, KarinNodeElement } from 'node-karin';
/**
 * - ICQQ适配器
 */
export declare class AdapterICQQ implements KarinAdapter {
    socket: WebSocket;
    account: KarinAdapter['account'];
    adapter: KarinAdapter['adapter'];
    version: KarinAdapter['version'];
    super: Client;
    constructor(bot: CfgType, name: string, version: string);
    init(bot: CfgType): Promise<void>;
    get self_id(): string;
    /**
     * icqq转karin
     * @return karin格式消息
     * */
    AdapterConvertKarin(data: Array<MessageElem>): Promise<Array<KarinElement>>;
    /**
     * karin转icqq
     * @param data karin格式消息
     * */
    KarinConvertAdapter(data: Array<KarinElement>): Promise<Array<MessageElem>>;
    logger(level: 'info' | 'error' | 'trace' | 'debug' | 'mark' | 'warn' | 'fatal', ...args: any[]): void;
    GetVersion(): Promise<{
        name: string;
        app_name: string;
        version: string;
    }>;
    SendMessage(contact: contact, elements: Array<KarinElement>): Promise<import("@icqqjs/icqq").MessageRet>;
    /**
     * 获取头像url
     * @param size 头像大小，默认`0`
     * @returns 头像的url地址
     */
    getAvatarUrl(user_id: string, size?: 0 | 40 | 100 | 140): string;
    /**
     * 获取群头像url
     * @param size 头像大小，默认`0`
     * @param history 历史头像记录，默认`0`，若要获取历史群头像则填写1,2,3...
     * @returns 头像的url地址
     */
    getGroupAvatar(group_id: string, size?: 0 | 40 | 100 | 140, history?: number): string;
    GetCurrentAccount(): Promise<{
        account_uid: string;
        account_uin: string;
        account_name: string;
    }>;
    RecallMessage(contact: contact, message_id: string): Promise<boolean>;
    ReactMessageWithEmoji(contact: contact, message_id: string, face_id: number, is_set: boolean): Promise<any>;
    VoteUser(target_uid_or_uin: string, vote_count: number): Promise<boolean>;
    sendForwardMessage(contact: contact, elements: KarinNodeElement[]): Promise<import("@icqqjs/icqq").MessageRet>;
    UploadForwardMessage(): Promise<any>;
    GetMessage(): Promise<any>;
    GetEssenceMessageList(): Promise<any>;
    DownloadForwardMessage(): Promise<any>;
    SetEssenceMessage(): Promise<any>;
    DeleteEssenceMessage(): Promise<any>;
    SetFriendApplyResult(): Promise<any>;
    SetGroupApplyResult(): Promise<any>;
    SetInvitedJoinGroupResult(): Promise<any>;
    UploadPrivateFile(): Promise<any>;
    UploadGroupFile(): Promise<any>;
    SendMessageByResId(): Promise<any>;
    GetHistoryMessage(): Promise<any>;
    KickMember(): Promise<any>;
    BanMember(): Promise<any>;
    SetGroupWholeBan(): Promise<any>;
    SetGroupAdmin(): Promise<any>;
    ModifyMemberCard(): Promise<any>;
    ModifyGroupName(): Promise<any>;
    LeaveGroup(): Promise<any>;
    SetGroupUniqueTitle(): Promise<any>;
    GetStrangerProfileCard(): Promise<any>;
    GetFriendList(): Promise<any>;
    GetGroupInfo(): Promise<any>;
    GetGroupList(): Promise<any>;
    GetGroupMemberInfo(): Promise<any>;
    GetGroupMemberList(): Promise<any>;
    GetGroupHonor(): Promise<any>;
}
