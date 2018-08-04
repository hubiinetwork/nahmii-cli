'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('node-yaml');
const os = require('os');
const readlineSync = require('readline-sync');

module.exports = {
    command : 'init [--force]',
    describe: 'Initializes the config file',
    builder : yargs => {
        yargs.option('force', {
            desc: 'replace existing config',
            default: false,
            type: 'boolean'
        })
    },
    handler : async (argv) => {
        const configPath = path.resolve(os.homedir(), '.striim/config.yaml');

        if (!argv.force && fs.existsSync(configPath)) {
            console.error('Config file already exists: ' + configPath);
            process.exit(-1);
        }

        if (!fs.existsSync(path.dirname(configPath)))
            fs.mkdirSync(path.dirname(configPath));

        console.log('Please specify the API server and credentials: [press ENTER for default value]');
        const apiRoot = readlineSync.question('apiRoot: [api2.dev.hubii.net] ') || 'api2.dev.hubii.net';
        const appId = readlineSync.question('appId: [] ');
        const appSecret = readlineSync.question('appSecret: [] ');
        const address = readlineSync.question('wallet address: [] ');
        const secret = readlineSync.question('wallet pass phrase: [] ');

        let config = {apiRoot, appId, appSecret, wallet: {address, secret}};

        yaml.writeSync(configPath, config);
        console.log('Template configuration created: ' + configPath);

        fs.chmodSync(configPath, 0o600);
    }
};
