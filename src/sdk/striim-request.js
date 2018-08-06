'use strict';

const request = require('superagent');
const {prefixSlash} = require('./utils');
const config = require('../config');

function getFromStriim(uri, authToken) {
    return request
        .get(`https://${config.apiRoot}${prefixSlash(uri)}`)
        .set('authorization', `Bearer ${authToken}`)
        .then(res => res.body);
}

module.exports = {
    get: getFromStriim
};
