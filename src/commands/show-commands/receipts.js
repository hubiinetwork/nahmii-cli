'use strict';

const dbg = require('../../dbg');
const nahmii = require('nahmii-sdk');

module.exports = {
    command: 'receipts',
    describe: 'Show receipts for my executed payments',
    builder: yargs => {
        yargs.options('from-nonce', {
            desc: 'Earliest possible nonce of receipt',
            type: 'number',
            default: 0
        });
        yargs.options('limit', {
            desc: 'Max number of receipts returned',
            type: 'number',
            default: 10
        });
        yargs.options('ascending', {
            desc: 'Return receipts in temporal ascending order',
            type: 'boolean',
            default: false
        });
    },
    handler: async (argv) => {
        const config = require('../../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);

        try {
            let receipts = await provider.getWalletReceipts(
                config.wallet.address, argv.fromNonce, argv.limit, argv.ascending
            );
            if (!receipts.length)
                receipts = [];
            console.log(JSON.stringify(receipts));
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to show receipts for executed payments.');
        }
        finally {
            provider.stopUpdate();
        }
    }
};
