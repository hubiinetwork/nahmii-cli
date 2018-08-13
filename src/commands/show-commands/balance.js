'use strict';

const striim = require('../../sdk');

module.exports = {
    command: 'balance',
    describe: 'Show my striim assets',
    builder: {},
    handler: async (argv) => {
        const config = require('../../config');
        const provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret);

        try {
            let wallet = new striim.Wallet(config.privateKey(config.wallet.secret), provider);
            let balances = await wallet.getStriimBalance();
            console.log(JSON.stringify(balances));
        }
        catch (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err);
            throw new Error('Unable to retrieve the balance.');
        }
    }
};
