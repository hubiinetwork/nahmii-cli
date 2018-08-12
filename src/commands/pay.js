'use strict';

const {prefix0x} = require('../sdk/utils');
const striim = require('../sdk');

module.exports = {
    command: 'pay <amount> <currency> to <recipient>',
    describe: 'Send <amount> of <currency> from your current wallet to the <recipient>\'s wallet',
    builder: {},
    handler: async (argv) => {
        const config = require('../config');

        try {
            const provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret, config.ethereum.node, config.ethereum.network);

            const authToken = await provider.getApiAccessToken();
            const tokens = await provider.getSupportedTokens();

            const tokenDefinition = tokens.find(t => t.symbol.toUpperCase() === argv.currency.toUpperCase());

            const amount = (parseFloat(argv.amount) * 10 ** tokenDefinition.decimals).toString();
            const currency = prefix0x(tokenDefinition.currency);
            const recipient = prefix0x(argv.recipient);
            const sender = prefix0x(config.wallet.address);

            const payment = new striim.Payment(amount, currency, sender, recipient);

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
