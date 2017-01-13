var version = '1.2';

var httpHostName = process.argv[2];
var host = process.argv[3];
var user = process.argv[4];
var password = process.argv[5];
var database = process.argv[6];

var MYSQL =
{
    db: {
        connectionLimit     : 10,
        queueLimit          : 5,
        host:host,
        user:user,
        password:password,
        database:database,
        port:3306
    }
};

var then                = require('thenjs');
var mysql               = require('aliyun-sdk').MYSQL;
var mysql_pool          = mysql.createPool(MYSQL.db);
var sqlSet              = require('./sqlSet.js');
var request             = require('request');
var qs                  = require('querystring');
var http                = require('http');

var CSTokenValueMap          = {};
var CSTokenTimeMap           = {};

//日期格式化
Date.prototype.format = function(format) {
    var date = {
        "M+":this.getMonth() + 1,
        "d+":this.getDate(),
        "h+":this.getHours(),
        "m+":this.getMinutes(),
        "s+":this.getSeconds(),
        "q+":Math.floor((this.getMonth() + 3) / 3),
        "S+":this.getMilliseconds()
    };

    if (new RegExp("(y+)", "i").test(format)) {
        format = format.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    }

    for (var k in date) {
        if (new RegExp("(" + k + ")").test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length == 1
                ? date[k] : ("00" + date[k]).substr(("" + date[k]).length));
        }
    }

    return format;
};
//日志
function log(msg)
{
    console.log((new Date()).format("yyyy-MM-dd hh:mm:ss")," ",msg);
}
//判断是否为空
function isNull(data){
    if (data=='0')
        return '0';
    else
        return (data == '' || data == undefined || data == null) ? '' : data;
}
//执行mysql
function execMySQL(sql, params)
{
    return then(function(cont) {
        mysql_pool.getConnection(cont);
    }).then(function(cont, conn) {
        conn.query(sql, params, function(err, rows) {
            conn.release();
            cont(err, rows);
        });
    })
} /* execMySQL */

//发送微信模版消息
function postMsg(content,token)
{
    return then(function(cont){
        try
        {
            var body = JSON.parse(content);
        }catch (e)
        {
            log("发送消息不是json格式数据,不能发送!");
            log(content);
            cont();
        }
        var options = {
            "rejectUnauthorized": false,
            headers: {"Connection": "close"},
            url: "https://api.weixin.qq.com/cgi-bin/message/template/send?access_token="+token,
            method: 'POST',
            json:true,
            body: body
        };
        function callback(error, response, data) {
            if (error)
                log(error);
            log('postMsg result:' + JSON.stringify(data));
            cont();
        }
        request(options, callback);
    });
}
//http请求Token
function httpGetToken(data,action,descript)
{
    return then(function(cont){
        var content = qs.stringify(data);
        var options = {
            hostname: httpHostName,
            port: 80,
            path: '/baas/myself/cswxplane/' + action + '?' + content,
            method: 'GET'
        };
        var req = http.request(options, function (res) {
            var size = 0;
            var chunks = [];
            res.on('data', function(chunk){
                size += chunk.length;
                chunks.push(chunk);
            });
            res.on('end', function (chunk) {
                var data = Buffer.concat(chunks, size);
                //如果不是json格式则退出
                try
                {
                    var result = JSON.parse(data.toString());
                }catch (e)
                {
                    log("请求 "+descript+' 返回数据不是json格式,返回信息:',data.toString());
                    cont();
                    return;
                }
                if (result.success)
                {
                    log("请求 "+descript+" 成功");
                    cont(null,result);
                }else
                {
                    log("请求 "+descript+" 无数据");
                    cont();
                }
            });
        });
        req.on('error', function (e) {
            log("请求 "+descript+" 出错:" + e.message);
            cont();
        });
        req.end();
    });
}

function processWxMsg(cont2)
{
    execMySQL(sqlSet.qryWaitSendTemplatMsg).eachSeries(null, function(cont, row) {
        var CS_ID = row.CS_ID;
        var WM_ID = row.WM_ID;
        var WM_Msg = row.WM_Msg;
        then(function(c)
        {
            log("token有效期剩余毫秒数:"+(new Date(CSTokenTimeMap[CS_ID]).getTime() - new Date().getTime()));
            log(new Date(CSTokenTimeMap[CS_ID]).getTime() + "|" + new Date().getTime());
            if (isNull(CSTokenValueMap[CS_ID])=='' | isNull(CSTokenTimeMap[CS_ID])=='' | new Date(CSTokenTimeMap[CS_ID]).getTime() - new Date().getTime() < 1000*60*10)//1000*60*10 有效期<10分钟则重新获取
            {
                log("调用httpGetToken");
                httpGetToken({CS_ID:CS_ID},"getWeiXinAccess_Token",CS_ID+"获取微信access_token").then(function(contHttp,result){
                    if (result)
                    {
                        CSTokenValueMap[CS_ID] = result.access_token;
                        CSTokenTimeMap[CS_ID] = result.validTime;
                        log("access_token:" + result.access_token + " 有效时间:" + result.validTime);
                        c();
                    }else
                    {
                        c();
                    }
                })
            }else
            {
                c();
            }
        }).then(function(){
            postMsg(WM_Msg,CSTokenValueMap[CS_ID]).then(function () {
                //修改已发送标志
                execMySQL(sqlSet.setMsgHasSend, [WM_ID]).then(function() {
                    cont();
                });
            });
        })
    }).fin(function() {
        cont2();
    }).fail(function(cont, err) {
        log('processWxMsg错误 :' + err);
        cont2();
    });
} /* test */

function start()
{
    then.parallel([processWxMsg]).fin(function() {
        setTimeout(function() {
            start();
        }, 1000 * 5);
    });
} /* start */
log('version:' + version);
log("2017-01-13 16:50:50 " + new Date('2017-01-13 16:50:50').getTime());
start();
