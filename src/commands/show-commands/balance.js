'use strict';

module.exports = {
    command: 'balance',
    describe: 'Show my striim assets',
    builder: {},
    handler: async (argv) => {
        const config = require('../../config');
        const {createApiToken} = require('../../sdk/identity-model');
        const {getStriimBalances} = require('../../sdk/balances-model');

        try {
            const authToken = await createApiToken();

            let balances = await getStriimBalances(authToken, config.wallet.address);
            if (!balances.length)
                balances = [];
            console.log(JSON.stringify(balances));
        }
        catch (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err);
            throw new Error('Unable to retrieve the balance.');
        }
    }
};
