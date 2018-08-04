'use strict';

const {prefix0x} = require('../sdk/utils');

module.exports = {
    command: 'pay <amount> <currency> to <recipient>',
    describe: 'Send <amount> of <currency> from your current wallet to the <recipient>\'s wallet',
    builder: {},
    handler: async (argv) => {
        const {createApiToken} = require('../sdk/identity-model');
        const {getSupportedTokens} = require('../sdk/tokens-model');
        const Payment = require('../sdk/payment-model');
        const config = require('../config');

        try {
            const authToken = await createApiToken();
            const tokens = await getSupportedTokens(authToken);

            const tokenDefinition = tokens.find(t => t.symbol.toUpperCase() === argv.currency.toUpperCase());

            const amount = (parseFloat(argv.amount) * 10 ** tokenDefinition.decimals).toString();
            const currency = prefix0x(tokenDefinition.currency);
            const recipient = prefix0x(argv.recipient);
            const sender = prefix0x(config.wallet.address);

            const payment = new Payment(amount, currency, sender, recipient);

            const secret = config.wallet.secret;
            const privateKey = config.privateKey(secret);
            payment.sign(privateKey);

            const response = await payment.register(authToken);

            console.debug(JSON.stringify(response));
        }
        catch (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err);
            throw new Error(`Payment failed: ${err.message}`);
        }
    }
};
