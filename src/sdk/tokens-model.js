'use strict';

const request = require('superagent');
const config = require('../config');

function getSupportedTokens(token) {
    return request
        .get(`https://${config.apiRoot}/ethereum/supported-tokens`)
        .set('authorization', `Bearer ${token}`)
        .then(res => res.body);
}

module.exports = {getSupportedTokens};
