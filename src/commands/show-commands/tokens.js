'use strict';

const dbg = require('../../dbg');
const nahmii = require('nahmii-sdk');

module.exports = {
    command: 'tokens',
    describe: 'Show tokens supported by nahmii',
    builder: {},
    handler: async () => {
        const config = require('../../config');
        const provider = new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);

        try {
            const supportedTokens = await provider.getSupportedTokens();
            if (supportedTokens.length) {
                const result = JSON.stringify(supportedTokens.map(t => {
                    return {
                        symbol: t.symbol,
                        currency: t.currency
                    };
                }));
                return console.log(result);
            }
            console.log([]);
        }
        catch (err) {
            dbg(err);
            throw new Error(`Unable to show supported tokens: ${err.message}`);
        }
        finally {
            provider.stopUpdate();
        }
    }
};
