'use strict';

const {createApiToken} = require('../../sdk/identity-model');
const {getSupportedTokens} = require('../../sdk/tokens-model');

module.exports = {
    command: 'tokens',
    describe: 'Show tokens supported by striim',
    builder: {},
    handler: async (argv) => {
        try {
            const authToken = await createApiToken();
            const supportedTokens = await getSupportedTokens(authToken);

            if (supportedTokens.length) {
                const result = JSON.stringify(supportedTokens.map(t => {
                    return {
                        symbol: t.symbol,
                        currency: t.currency
                    }
                }));
                return console.log(result);
            }
            console.log([]);
        }
        catch (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err);
            throw new Error(`Unable to show supported tokens: ${err.message}`);
        }
    }
};
