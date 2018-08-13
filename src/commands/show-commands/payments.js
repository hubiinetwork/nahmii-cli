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
            return payment.sender.toUpperCase() === config.wallet.address.toUpperCase()
                || payment.recipient.toUpperCase() === config.wallet.address.toUpperCase();
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
