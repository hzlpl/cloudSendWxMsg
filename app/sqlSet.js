//查询待发送的模版消息
module.exports.qryWaitSendTemplatMsg = ' select CS_ID,WM_ID,WM_WXUserID,WM_Msg'
    + ' from WX_Msg'
    + ' where WM_IfSended=0';
//修改消息为已发送
module.exports.setMsgHasSend = ' update WX_Msg set WM_IfSended=1,WM_SendDateTime=now()'
    + ' where WM_ID=?';