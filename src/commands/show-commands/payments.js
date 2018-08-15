'use strict';

const striim = require('../../sdk');

function isSameAddress(a, b) {
    a = striim.utils.strip0x(a).toLowerCase();
    b = striim.utils.strip0x(b).toLowerCase();
    return a === b;
}

module.exports = {
    command: 'payments',
    describe: 'Show my pending payments',
    builder: {},
    handler: async (argv) => {
        const config = require('../../config');
        const provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret);

        const isMyPayment = (payment) => {
            return isSameAddress(payment.sender.addr, config.wallet.address)
                || isSameAddress(payment.recipient.addr, config.wallet.address);
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
