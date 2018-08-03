'use strict';

const {createApiToken} = require('../sdk/identity-model');
const config = require('../config');

module.exports = {
    command: 'config',
    describe: 'Does some simple checks on the current configuration and displays the essentials.',
    builder: {},
    handler: async (argv) => {
        console.log(`Using configuration from ${config.file}:`);
        console.log(`\tapiRoot: ${config.apiRoot}`);
        console.log(`\tappId: ${config.appId}`);
        console.log(`\tappSecret: ${'*'.repeat(20)}`);
        console.log(`\twallet address: ${config.wallet.address}`);
        console.log(`\twallet secret: ${'*'.repeat(20)}`);

        try {
            let token = await createApiToken();
            console.log('Successfully authenticated with API servers!');
        }
        catch (err) {
            throw new Error('Unable to authenticate using current configuration.');
        }
    }
};
