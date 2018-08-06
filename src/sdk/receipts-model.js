'use strict';

const striim = require('./striim-request');

function getAllReceipts(authToken) {
    return striim.get('/trading/receipts', authToken);
}

module.exports = {getAllReceipts};
