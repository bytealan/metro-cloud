'use strict'

/**
 * 依赖
 */
const nodeMailer = require('nodemailer');
const axios = require('axios');

/**
 * 配置
 */
const config = {
    'apiUrl': {
        'checkHoliday': 'https://tool.bitefu.net/jiari/?d=',
        'createAppointment': 'https://webapi.mybti.cn/Appointment/CreateAppointment'
    },
    'authorization': '',
    'time': '0810-0820',
    'email': {
        'qq': {
            'user': '84963568@qq.com',
            'from': '84963568@qq.com',
            'to': '84963568@qq.com',
            'pass': ''
        }
    }
}

/**
 * 地铁预约代码
 */

// 检查今天是否需要抢票
const checkTomorrowIsHoliday = async () => {
    const { apiUrl } = config;
    let now = new Date();
    let tomorrow = '' + now.getFullYear() + (now.getMonth() + 1) + (now.getDate() + 1)
    let { data } = await axios({ url: apiUrl.checkHoliday + tomorrow, method: 'get' });
    if (data === 1) {
        global.isReservation = false;
    }else{
        global.isReservation = true;
    }
}

// Token过期时间检查
const checkToken = () => {
    const { authorization } = config;
    let aToken = Buffer.from(authorization , 'base64').toString();
    let aTokens = aToken.split(',');
    let tokenRxpireTime = new Date(parseFloat(aTokens[1]));
    let now = new Date();
    let reservationTime = new Date(now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + (now.getDate() + 1) + ' 23:59:59');
    if (tokenRxpireTime < reservationTime) {
        //token过期了，发送邮件提醒
        sendEmailFromQQ('地铁预约：Token过期，请及时更换', '请于及时更换，以免下次预约失败');
    }else{
        console.log('Token检查完成，过期时间为：' + tokenRxpireTime.toString());
    }
}

// 地铁预约
const createAppointment = async () => {
    const { apiUrl, authorization, time } = config;
    let now = new Date();
    let tomorrow = '' + now.getFullYear() + (now.getMonth() + 1) + (now.getDate() + 1)
    let params = {
        'timeSlot':time,
        'lineName':'昌平线',
        'snapshotTimeSlot':'0630-0930',
        'enterDate':tomorrow,
        'stationName':'沙河站',
        'snapshotWeekOffset':0
    }
    let count = 0;
    let res = false;
    while(count < 5){
        let { data } = await axios({
            url: apiUrl.createAppointment,
            method: 'post',
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json;charset=UTF-8',
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
            },
            data: params,
            timeout: 10000
        })
        if (data.balance > 0) {
            console.log('预约成功: ' + JSON.stringify(data));
            res = true;
            break;
        }else{
            console.log('预约失败: ' + JSON.stringify(data));
        }
        count++;
    }
    if (res) {
        await sendEmailFromQQ('地铁预约：预约成功！预约日期为：' + tomorrow, '');
    }else{
        await sendEmailFromQQ('地铁预约：预约失败！', '');
    }
}

// 邮件发送
const sendEmailFromQQ = async (subject, html) => {
    let cfg = config.email.qq;
    if (!cfg || !cfg.user || !cfg.pass) return;
    const transporter = nodeMailer.createTransport({service: 'qq', auth: {user: cfg.user, pass: cfg.pass}});
    transporter.sendMail({
        from: cfg.from,
        to: cfg.to,
        subject: subject,
        html: html
    }, (err) => {
        if (err) return console.log(`发送邮件失败：${err}`, true);
        console.log('发送邮件成功')
    })
}

exports.metro = async (event, context) => {
    console.log('触发定时任务');
    switch (event.Message) {
        case 'createAppointment':
            if (global.isReservation) {
                console.log('开始预约');
                await createAppointment();
                console.log('结束预约');
            }
            break;
        case 'checkHoliday': 
            console.log('开始检查假期');
            await checkTomorrowIsHoliday();
            console.log('结束检查假期');
            break;
        case 'checkToken': 
            console.log('开始检查Token');
            checkToken();
            console.log('结束检查Token');
            break;
        default:
            console.log('未传任何参数');
            break;
    }
};