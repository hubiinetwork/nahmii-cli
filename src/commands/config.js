'use strict';

const Web3Eth = require('web3-eth');

module.exports = {
    command: 'config',
    describe: 'Does some simple checks on the current configuration and displays the essentials.',
    builder: {},
    handler: async (argv) => {
        const {createApiToken} = require('../sdk/identity-model');
        const config = require('../config');

        console.log(`Using configuration from ${config.file}:`);
        console.log(`\tapiRoot: ${config.apiRoot}`);
        console.log(`\tappId: ${config.appId}`);
        console.log(`\tappSecret: ${'*'.repeat(config.appSecret.length ? 20: 0)}`);
        console.log(`\twallet address: ${config.wallet.address}`);
        console.log(`\twallet secret: ${'*'.repeat(config.wallet.secret.length ? 20 : 0)}`);

        try {
            let token = await createApiToken(config.apiRoot, config.appId, config.appSecret);
            console.log('Successfully authenticated with API servers!');
        }
        catch (err) {
            throw new Error('Unable to authenticate using current configuration.');
        }

        try {
            let eth = new Web3Eth(config.ethereum.node);
            let connected = await eth.net.isListening();
            console.log('Successfully connected to Ethereum network!');
        }
        catch (err) {
            if (env.LOG_LEVEL === 'debug')
                throw new Error('Unable to connect to Ethereum network.', err);
            throw new Error('Unable to connect to Ethereum network.');
        }
    }
};
