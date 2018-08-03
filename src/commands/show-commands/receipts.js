'use strict';

const cfg = require('../../config');
const {createApiToken} = require('../../sdk/identity-model');
const {getAllReceipts} = require('../../sdk/receipts-model');
const request = require('superagent');

const isMyReceipt = (receipt) => {
    return receipt.sender.addr === cfg.wallet.address || receipt.recipient.addr === cfg.wallet.address;
};

module.exports = {
    command: 'receipts',
    describe: 'Show receipts for my executed payments',
    builder: {},
    handler: async (argv) => {
        try {
            const authToken = await createApiToken();

            let receipts = await getAllReceipts(authToken);
            if (!receipts.length)
                receipts = [];
            receipts = receipts.filter(isMyReceipt);
            console.log(receipts);
        }
        catch (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err);
            throw new Error('Unable to show receipts for executed payments.');
        }
    }
};
