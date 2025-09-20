import { Client } from 'icqq'

export class ICQQClient extends Client {
  async getCmdWhiteList () {
    const baseWhiteList = await super.getCmdWhiteList()
    return [
      'wtlogin.login',
      'wtlogin.exchange_emp',
      'MessageSvc.PbSendMsg',
      'MsgProxy.SendMsg',
      'OidbSvcTrpcTcp.0x6d9_2',
      'OidbSvcTrpcTcp.0x6d9_4',
      'trpc.o3.ecdh_access.EcdhAccess.SsoEstablishShareKey',
      'trpc.o3.ecdh_access.EcdhAccess.SsoSecureA2Establish',
      'trpc.o3.ecdh_access.EcdhAccess.SsoSecureA2Access',
      'trpc.o3.ecdh_access.EcdhAccess.SsoSecureAccess',
      'ProfileService.Pb.ReqSystemMsgAction.Group',
      ...baseWhiteList,
    ]
  }
}
