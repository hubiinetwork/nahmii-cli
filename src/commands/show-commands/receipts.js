'use strict';

const dbg = require('../../dbg');
const nahmii = require('nahmii-sdk');
const {strip0x} = nahmii.utils;

module.exports = {
    command: 'receipts',
    describe: 'Show receipts for my executed payments',
    builder: {},
    handler: async () => {
        const config = require('../../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);

        const isMyReceipt = (receipt) => {
            return strip0x(receipt.sender.wallet.toUpperCase()) === strip0x(config.wallet.address.toUpperCase())
                || strip0x(receipt.recipient.wallet.toUpperCase()) === strip0x(config.wallet.address.toUpperCase());
        };

        try {
            let receipts = await provider.getAllReceipts();
            if (!receipts.length)
                receipts = [];
            receipts = receipts.filter(isMyReceipt);
            console.log(JSON.stringify(receipts));
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to show receipts for executed payments.');
        }
        finally {
            provider.stopUpdate();
        }
    }
};
