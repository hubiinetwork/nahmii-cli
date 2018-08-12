'use strict';

const striim = require('../../sdk');

module.exports = {
    command: 'receipts',
    describe: 'Show receipts for my executed payments',
    builder: {},
    handler: async (argv) => {
        const config = require('../../config');

        const isMyReceipt = (receipt) => {
            return receipt.sender.addr.toUpperCase() === config.wallet.address.toUpperCase()
                || receipt.recipient.addr.toUpperCase() === config.wallet.address.toUpperCase();
        };

        try {
            const provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret, config.ethereum.node, config.ethereum.network);

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
