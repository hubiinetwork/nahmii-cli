'use strict';

const path = require('path');
const fs = require('fs');
const ethers = require('ethers');
const yaml = require('node-yaml');
const {JSON_SCHEMA} = require('js-yaml');
const homedir = require('os').homedir();

const configPath = path.resolve(homedir, '.nahmii/config.yaml');
if (!fs.existsSync(configPath)) {
    console.error('Unable to locate config file: ' + configPath);
    process.exit(-1);
}

const stats = fs.statSync(configPath);
if ((stats.mode & 0o77) !== 0)
    console.error('WARNING: Config file should only be readable by the owner!');

const cfg = yaml.readSync(configPath, {schema: JSON_SCHEMA});
if (!cfg) {
    console.error('Unable to load config file: ' + configPath);
    process.exit(-1);
}
cfg.file = configPath;

cfg.privateKey = async (secret) => {
    const files = fs.readdirSync(path.join(homedir, '.nahmii', 'keystore'));
    const regex = new RegExp(cfg.wallet.address.replace('0x', ''), 'i');
    const matchedFile = files.filter(f => f.match(regex)).shift();
    if (!matchedFile) 
        throw new Error(`Unable to find keystore file for wallet ${cfg.wallet.address}`);
    
    const keystore = fs.readFileSync(path.join(homedir, '.nahmii', 'keystore', matchedFile));
    const wallet = await ethers.Wallet.fromEncryptedJson(keystore, secret);
    return wallet.privateKey;
};

module.exports = cfg;
