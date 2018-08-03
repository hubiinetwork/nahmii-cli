'use strict';

const request = require('superagent');
const config = require('../config');

function createApiToken() {
    return request
        .post(`https://${config.apiRoot}/identity/apptoken`)
        .send({
            'appid': config.appId,
            'secret': config.appSecret
        })
        .then(res => res.body.userToken);
}

module.exports = {createApiToken};
