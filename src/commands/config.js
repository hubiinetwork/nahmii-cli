'use strict';

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
            let token = await createApiToken();
            console.log('Successfully authenticated with API servers!');
        }
        catch (err) {
            throw new Error('Unable to authenticate using current configuration.');
        }
    }
};
