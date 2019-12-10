/**
 * Created by 2017 on 2018/2/6.
 */
/**
 *http 客户端处理工具
 * User: liyangli
 * Date: 2017/3/10
 * Time: 14:30
 */
var http = require('http');
var querystring = require('querystring');


/**
 * http连接的客户端；主要进行和底层发送对应协议
 * @constructor
 * @param query 请求头信息 {ip:"xxx",port: 80,url: '/xx/',method: "post"}
 * @param cb 回调方法 (err,data) 回调第一个参数为err，第二个参数为具体响应数据
 */
var HttpBhClient = function HttpBhClient(query,cb){
    this.query = query;
    this.cb = cb;
};

HttpBhClient.prototype = {
    /**
     * 真正发送动作
     * @param stbIp 机顶盒IP
     * @param data 发送的数据
     * @param attr 事件的名称
     */
    send: function(data){
        var option = this._findOption();
        var self = this;
        var req = http.request(option, function(res) {

            //设定对应超时时间
            var timer = setTimeout(function () {
                if(!self.cb){
                    return;
                }
                self.cb("timeout");
            }, 5000);


            res.setEncoding('utf8');
            var resData = "";
            res.on('data', function (chunk) {
                resData += chunk;
            });
            res.on('end',function(){
//                 let cookie = this.res.getHeader("Set-Cookie");
                    let cookieObj = this.headers["set-cookie"];
                    let cookie = "";
                    if(cookieObj){
                        let cookieStr = cookieObj[0];
                       let start = cookieStr.indexOf("=");
                       let end = cookieStr.indexOf(";",start+1);
                       cookie = cookieStr.substring(start+1,end);
                    }
                   
//                 console.info(cookie);
                clearTimeout(timer);
                if(!self.cb){
                    return;
                }
                self.cb(null,resData,cookie);
            });

        });
        req.on("error",function(err){
            self.ev.emit(self.attr,"err");
        });
        console.info("===== httpClient send data ===============");
        if(data){req.write(data);}
        req.end();
    },
    _findOption: function(){
        //获取连接的配合
        let headers = this.query.headers?this.query.headers:{
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-length': 0
        }

        var options = {
            host: this.query.ip,
            port: this.query.port,
            path:this.query.url,
            method:this.query.method,
            headers: headers
        };
        return options;
    },
    /**
     * 上传数据
     * @param {Buffer} data 
     */
    upload: function(fileName,data){
        let self = this;
        let boundary = "----WebKitFormBoundaryxmX3lBwOP62AQsIM";
        let sHeader = "--" + boundary + "\r\n";
        sHeader += "Content-Disposition: form-data; name=\"name\"\r\n";
        sHeader += "\r\n"+fileName+"\r\n";
        sHeader += "--" + boundary + "\r\n";
        sHeader += "Content-Disposition: form-data; name=\"path\"\r\n";
        sHeader += "\r\n"+fileName+"\r\n";
        sHeader += "--" + boundary + "\r\n";
        sHeader += "Content-Disposition: form-data; name=\"file\"; filename=\"" + fileName + "\"\r\n";
        sHeader += "Content-Type: application/octet-stream\r\n\r\n";
        let sEndData = "\r\n--" + boundary + "--\r\n";
        let options = this._findOption();
        let httpreq = http.request(options, function (httpres) {
            httpres.on('data', function (dataResponse) {
                var response = JSON.parse(dataResponse);
                self.cb(response);
            });
        });
        httpreq.setHeader('Content-Type',   'multipart/form-data; boundary=' + boundary + '');
        httpreq.setHeader('Content-Length', Buffer.byteLength(sHeader) + data.length + Buffer.byteLength(sEndData));
        httpreq.setHeader('Cookie', "auth=BHKJ88955480");
        httpreq.setHeader("Connection","keep-alive");
     
        httpreq.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            callback(e);
            return;
        });
     
        httpreq.write(sHeader);
        httpreq.write(data);
        httpreq.write(sEndData);
        httpreq.end();
    }
};
// let cb = function(resp){
//     console.info(resp);
// }
// let httpClient = new HttpBhClient({
//     ip: "172.17.13.132",
//     port: "19380",
//     url: "/cgi-bin/total.cgi?path=/sys/updateDevice",
//     method: "POST",
//     headers: {}
// },cb);
// const fs = require("fs");
// let path = "/Users/liyangli/Desktop/";
// let fileName = "BHIP193-D_3.0.0.21.hexbh";
// fs.readFile(path+fileName, function (err, data) {
//     if (err) throw err;
//     console.log(data.length);
//     httpClient.upload(fileName,data);
// });

// setTimeout(()=>{
//     console.info("整体完成");
// },10*60*1000);

module.exports = HttpBhClient;


