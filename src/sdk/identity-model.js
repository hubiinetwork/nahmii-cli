'use strict';

const request = require('superagent');
const config = require('../config');

function createApiToken(baseUrl, appId, appSecret) {
    baseUrl = baseUrl || config.apiRoot;
    appId = appId || config.appId;
    appSecret = appSecret || config.appSecret;

    return request
        .post(`https://${baseUrl}/identity/apptoken`)
        .send({
            'appid': appId,
            'secret': appSecret
        })
        .then(res => res.body.userToken);
}

module.exports = {createApiToken};
