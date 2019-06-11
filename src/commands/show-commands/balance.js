'use strict';

const dbg = require('../../dbg');
const nahmii = require('nahmii-sdk');

module.exports = {
    command: 'balance',
    describe: 'Show my nahmii assets',
    builder: {},
    handler: async () => {
        const config = require('../../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);

        try {
            const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const balances = await wallet.getNahmiiBalance();
            console.log(JSON.stringify(balances));
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to retrieve the balance.');
        }
        finally {
            provider.stopUpdate();
        }
    }
};
