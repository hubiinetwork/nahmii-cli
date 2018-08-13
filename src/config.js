'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('node-yaml');
const keythereum = require('keythereum');
const homedir = require('os').homedir();
const {prefix0x} = require('./sdk/utils');

const configPath = path.resolve(homedir, '.striim/config.yaml');
if (!fs.existsSync(configPath)) {
    console.error('Unable to locate config file: ' + configPath);
    process.exit(-1);
}

const stats = fs.statSync(configPath);
if ((stats.mode & 0o77) !== 0)
    console.error('WARNING: Config file should only be readable by the owner!');

const cfg = yaml.readSync(configPath, {schema: yaml.schema.json});
if (!cfg) {
    console.error('Unable to load config file: ' + configPath);
    process.exit(-1);
}
cfg.file = configPath;

cfg.privateKey = (secret) => {
//    console.debug(`Using key '${cfg.wallet.address}' for signing.`);
    const keyObject = keythereum.importFromFile(cfg.wallet.address, path.resolve(homedir, '.striim'));
    return prefix0x(keythereum.recover(secret, keyObject).toString('hex'));
};

module.exports = cfg;
