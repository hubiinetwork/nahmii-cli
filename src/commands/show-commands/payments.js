'use strict';

const striim = require('../../sdk');

module.exports = {
    command: 'payments',
    describe: 'Show my pending payments',
    builder: {},
    handler: async (argv) => {
        const config = require('../../config');
        const provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret);

        const isMyPayment = (payment) => {
            return payment.sender.addr.toLowerCase() === config.wallet.address.toLowerCase()
                || payment.recipient.addr.toLowerCase() === config.wallet.address.toLowerCase();
        };

        try {
            let payments = await provider.getPendingPayments();
            if (!payments.length)
                payments = [];
            payments = payments.filter(isMyPayment);
            console.log(JSON.stringify(payments));
        }
        catch (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err);
            throw new Error('Unable to show pending payments.');
        }
    }
};
