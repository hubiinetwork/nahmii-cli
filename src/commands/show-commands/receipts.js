'use strict';

const striim = require('../../sdk');
const {strip0x} = striim.utils;

module.exports = {
    command: 'receipts',
    describe: 'Show receipts for my executed payments',
    builder: {},
    handler: async (argv) => {
        const config = require('../../config');

        const isMyReceipt = (receipt) => {
            return strip0x(receipt.sender.addr.toUpperCase()) === strip0x(config.wallet.address.toUpperCase())
                || strip0x(receipt.recipient.addr.toUpperCase()) === strip0x(config.wallet.address.toUpperCase());
        };

        try {
            const provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret);

            let receipts = await provider.getAllReceipts();
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
