'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');

module.exports = {
    command: 'config',
    describe: 'Does some simple checks on the current configuration and displays the essentials.',
    builder: {},
    handler: async () => {
        const config = require('../config');

        console.log(`Using configuration from ${config.file}:`);
        console.log(`\tapiRoot: ${config.apiRoot}`);
        console.log(`\tappId: ${config.appId}`);
        console.log(`\tappSecret: ${'*'.repeat(config.appSecret.length ? 20: 0)}`);
        console.log(`\twallet address: ${config.wallet.address}`);
        console.log(`\twallet secret: ${'*'.repeat(config.wallet.secret.length ? 20 : 0)}`);

        const provider = new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);

        try {
            await Promise.all([
                provider.getBlockNumber(),
                provider.getApiAccessToken()
            ]);
            console.log('Successfully connected to network!');
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to connect to network! Check your configuration and network connection.');
        }
        finally {
            provider.stopUpdate();
        }
    }
};
