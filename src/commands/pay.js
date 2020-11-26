'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const prefix0x = nahmii.utils.prefix0x;
const ethers = require('ethers');

module.exports = {
    command: 'pay <amount> <currency> to <recipient>',
    describe: 'Send <amount> of <currency> from your current wallet to the <recipient>\'s wallet',
    builder: yargs => {
        yargs.option('payload', {
            desc: 'Stringified payload of payment, with a maximum length of 256 characters',
            type: 'string',
            hidden: true
        });
    },
    handler: async (argv) => {
        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const privateKey = await config.privateKey(config.wallet.secret);
        const wallet = new nahmii.Wallet(privateKey, provider);

        try {
            const currencyDefinition = await getCurrencyBySymbol(provider, argv.currency);
            const currency = prefix0x(currencyDefinition.currency);

            const amount = nahmii.MonetaryAmount.from(ethers.utils.parseUnits(argv.amount, currencyDefinition.decimals), currency);
            const recipient = prefix0x(argv.recipient);
            const sender = prefix0x(config.wallet.address);

            const payment = new nahmii.Payment(amount, sender, recipient, wallet, undefined, argv.payload);
            await payment.sign();

            const response = await payment.register();
            console.log(JSON.stringify(response));
        }
        catch (err) {
            dbg(err);
            throw new Error(`Payment failed: ${err.message}`);
        }
        finally {
            provider.stopUpdate();
        }
    }
};

async function getCurrencyBySymbol(provider, symbol) {
    if (symbol.toUpperCase() === 'ETH') {
        return {
            currency: prefix0x('00'.repeat(20)),
            decimals: 18,
            symbol: 'ETH'
        };
    }

    const tokens = await provider.getSupportedTokens();
    return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
}
