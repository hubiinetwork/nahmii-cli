'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('node-yaml');
const os = require('os');
const readlineSync = require('readline-sync');

module.exports = {
    command: 'init [--force]',
    describe: 'Initializes the config file',
    builder: yargs => {
        yargs.option('force', {
            desc: 'replace existing config',
            default: false,
            type: 'boolean'
        });
    },
    handler: async (argv) => {
        const configDir = path.resolve(os.homedir(), '.nahmii');
        const configFile = path.resolve(configDir, 'config.yaml');
        const keystoreDir = path.resolve(configDir, 'keystore');

        if (!argv.force && fs.existsSync(configFile)) {
            console.error('Config file already exists: ' + configFile);
            process.exit(-1);
        }

        if (!fs.existsSync(configDir))
            fs.mkdirSync(configDir);
        if (!fs.existsSync(keystoreDir))
            fs.mkdirSync(keystoreDir);

        console.log('Please specify the API server and credentials: [press ENTER for default value]');
        const apiRoot = readlineSync.question('apiRoot: [api2.dev.hubii.net] ') || 'api2.dev.hubii.net';
        const appId = readlineSync.question('appId: [] ');
        const appSecret = readlineSync.question('appSecret: [] ');
        const address = readlineSync.question('wallet address: [] ');
        const secret = readlineSync.question('wallet pass phrase: [] ');

        const config = {apiRoot, appId, appSecret, wallet: {address, secret}};

        yaml.writeSync(configFile, config);
        console.log('Template configuration created: ' + configFile);

        fs.chmodSync(configFile, 0o600);
    }
};
