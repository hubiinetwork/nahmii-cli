'use strict';

const request = require('superagent');
const config = require('../config');

function getAllReceipts(token) {
    return request
        .get(`https://${config.apiRoot}/trading/receipts`)
        .set('authorization', `Bearer ${token}`)
        .then(res => res.body);
}

module.exports = {getAllReceipts};
