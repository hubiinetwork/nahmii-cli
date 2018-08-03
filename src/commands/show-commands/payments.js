'use strict';

const cfg = require('../../config');
const {createApiToken} = require('../../sdk/identity-model');
const Payment = require('../../sdk/payment-model');
const request = require('superagent');

const isMyPayment = (payment) => {
    return payment.sender.addr === cfg.wallet.address || payment.recipient.addr === cfg.wallet.address;
};

module.exports = {
    command: 'payments',
    describe: 'Show my pending payments',
    builder: {},
    handler: async (argv) => {
        try {
            const authToken = await createApiToken();

            let payments = await Payment.getPendingPayments(authToken);
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
