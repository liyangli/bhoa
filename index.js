const BhHttpClient = require("./http_client_cb");
const Koa = require("koa");
const app = new Koa();
const urlencode = require("urlencode");
const cheerio = require("cheerio");
const moment = require("moment");

app.use(async (ctx,next)=>{
    await next();
    let request = ctx.request;
    let req_query = request.query;
    let cookie = req_query.cookie;
    let name = req_query.name;

    if(!cookie && !name){
        ctx.response.body="需要设置cookie值";
        return;
    }
    let start = req_query.start;
    if(!start){
        ctx.response.body="需要设置开始日期";
        return;
    }
    let end = req_query.end;
    if(!end){
        ctx.response.body="需要设置结束日期";
        return;
    }
    let oaUtil = new OaUtil();
    if(name){
        cookie = await oaUtil.findUserCookie(name);
    }
    //开始调用具体处理逻辑；
    
    let content = await oaUtil.dealFindCnt(cookie,start,end);
    ctx.response.body=content;
});

class OaUtil{

    findUserCookie(name){
        let time = moment().format("YYYY/MM/DD HH:mm:ss");
        
        let url = "/index.aspx?empno="+name+"&t="+urlencode(time);
        console.info(url);
        let option = {
            ip:"172.17.1.17",
            port: 81,
            url: url,
            method: "GET",
            headers: {
                
            }
        };
        return new Promise((resolve,reject)=>{
            let bhHttpClient = new BhHttpClient(option,(err,resp,cookie)=>{
                if(err){
                    console.info("出现错误了");
                    reject(err);
                    return;
                }
                resolve(cookie);
            });
            bhHttpClient.send();
        });
    }

    /**
     * 获取第一页数据；
     */
    findFirst(cookie){
        let option = {
            ip:"172.17.1.17",
            port: 81,
            url: "/employeeConsols/MyOverTimeManage.aspx",
            method: "GET",
            headers: {
                "Cookie":"ASP.NET_SessionId="+cookie
                
            }
        };
        return new Promise((resolve,reject)=>{
            let bhHttpClient = new BhHttpClient(option,(err,resp)=>{
                if(err){
                    console.info("出现错误了");
                    reject(err);
                    return;
                }
                resolve(resp);
            });
            bhHttpClient.send();
        });
        
    }

    findSecond(cookie,VIEWSTATE){
        let option = {
            ip:"172.17.1.17",
            port: 81,
            url: "/employeeConsols/MyOverTimeManage.aspx",
            method: "POST",
            headers: {
                "Cookie":"ASP.NET_SessionId="+cookie,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };
        return new Promise((resolve,reject)=>{
            let bhHttpClient = new BhHttpClient(option,(err,resp)=>{
                if(err){
                    console.info("出现错误了");
                    reject(err);
                    return;
                }
                resolve(resp);
            });
            VIEWSTATE = urlencode(VIEWSTATE);
            let goto = urlencode("转到");
            let data = "__VIEWSTATE="+VIEWSTATE+"&tb_pageSize=200&tb_currentPageIndex=1&btnGo="+goto;

            bhHttpClient.send(data);
        });
        
    }

    /**
     * 处理获取内容数据
     */
    async dealFindCnt(cookie,start,end){
        //1、获取第一数据，获取对应content;
        let content = await this.findFirst(cookie);
        // console.info(content);
        //解析一下内容；获取对应内容数据
        let cntMsg = content.split("\r\n");
        let VIEWSTATE = "";
        for(let msg of cntMsg){
            if(msg.indexOf("__VIEWSTATE") == -1){
                continue;
            }
            // console.info(msg);
            // 获取具体value中对应值
            let startIndex = msg.indexOf("value=\"");
            let endIndex = msg.indexOf("\"",startIndex+7);
            console.info(startIndex+"::"+endIndex);
            VIEWSTATE = msg.substring(startIndex+7,endIndex);
        }
        if(!VIEWSTATE){
            return;
        }
        //2、获取第二页数据；
        let parseCnt = await this.findSecond(cookie,VIEWSTATE);
        let dates = this.parseContent(parseCnt,start,end);
        let contentDate = this.dealDate(dates);
        return contentDate;

    }

    dealDate(dates){
        let content = {
            days: dates.length,
            desc: ""
        }

        //key: month;val:本月字符串
        let map = new Map();
        for(let date of dates){
            let time = moment(date)
            let month = time.get('month')+1;
            let msg = map.get(month);
            if(!msg){
                msg = "";
            }else{
                msg += "/";
            }

            msg += time.get('date');
            map.set(month,msg);
        }

        //循环遍历对应map内容；
        let flag = false;
        let desc = "";
        let list = Array.from(map);
        list.sort((a,b)=>{
            return a[0]-b[0];
        })
        for(let entry of list){
            let month = entry[0];
            let msg = entry[1];
            if(flag){
                desc += ",";
            }else{
                flag = true;
            }
            desc += month+"."+msg;
        }
        content.desc = desc;

        return content;
    }

    parseContent(content,start,end){
        // console.info(content);
        let $ = cheerio.load(content,{normalizeWhitespace: true});
        let rows = $(".GridViewStyle","tr");
        let dates = [];
        let children = rows.children().children();
        let startDate = new Date(start);
        let endDate = new Date(end);
        let len = children.length;
        for(let i=len -1 ;i>=0;i--){
            let trNode = children[i];
            let className = trNode.attribs.class;
            if(className != "GridViewRowStyle" && className!="GridViewAlternatingRowStyle"){
                continue;
            }
            //获取每一行数据
            let tdNodes = trNode.children;
            let dateNode = tdNodes[4];
            let date = cheerio.load(dateNode).text().replace(/\s+/g,"");
            let now = new Date(date);
            if(now.getTime()<startDate.getTime() ){
                continue;
            }
            if(now.getTime() > endDate.getTime()){
                continue;
            }
            dates.push(date);
        }
        return dates;
        //组装需要显示的内容
        // let childNodes = rows.childNodes;
        // console.info(childNodes.text());
        // for(let i in childNodes){
        //     let child = childNodes[i];
        //     console.info(child.text());
        // }
        // let msgCnt = rows.text();
        // msgCnt = msgCnt.replace(/\s+/g,"");
        // let msgs = msgCnt.split("\t\t\t\n");
        // console.info(msgs);
    }
}

app.listen(3000);
console.info("开始监听");