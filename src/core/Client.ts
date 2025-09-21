import { hd, mobile, tim, watch } from '@/imports/device'
import { Apk, Client, Platform } from 'icqq'

export class ICQQClient extends Client {
  async getCmdWhiteList () {
    const baseWhiteList = await super.getCmdWhiteList()
    return [
      // 后续扩展cmd
      ...baseWhiteList
    ]
  }

  getApkInfoList (platform: Platform) {
    const apklist: Record<Platform, Apk | Apk[]> = {
      [Platform.Android]: mobile,
      [Platform.aPad]: mobile.map(apk => ({
        ...apk,
        subid: apk?.apad_subid || apk.subid,
        display: apk?.apad_subid ? 'aPad' : apk.display,
      })),
      [Platform.Watch]: watch,
      [Platform.iMac]: hd,
      [Platform.iPad]: {
        ...mobile[0],
        id: 'com.tencent.mqq',
        subid: 537155074,
        sign: hd.sign,
        name: '8.9.50.611',
        version: '8.9.50.611',
        ver: '8.9.50',
        sdkver: '6.0.0.2535',
        qua: '',
        display: 'iPad',
        ssover: 19,
      },
      [Platform.Tim]: tim,
      [Platform.Custom]: []
    }
    const apkData = apklist[platform]
    return Array.isArray(apkData) ? apkData : [apkData]
  }
}
