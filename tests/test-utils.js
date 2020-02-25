'use strict';

const yaml = require('node-yaml');
const shell = require('shelljs');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');


function getNahmiiConfig () {
    return yaml.readSync(shell.ls('~/.nahmii/config.yaml').toString());
}

let _nahmiiProvider;

async function getNahmiiProvider () {
    if (!_nahmiiProvider) {
        const config = getNahmiiConfig();
        _nahmiiProvider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
    }

    return _nahmiiProvider;
}

async function delay12Blocks () {
    const provider = await getNahmiiProvider();
    const b0 = await provider.getBlockNumber();
    const nextBlockNo = () => new Promise(resolve => provider.once('block', resolve));

    for (let b = b0; b <= (b0 + 12); b = await nextBlockNo())
        process.stdout.write(`Waiting for: ${b} > ${b0 + 12}\r`);
}

async function getConfigWallet () {
    const address = getNahmiiConfig().wallet.address;
    const secret = getNahmiiConfig().wallet.secret;
    const keystore = shell.exec(`cat ~/.nahmii/keystore/*${address}*`).toString();

    const signer = await ethers.Wallet.fromEncryptedJson(keystore, secret);
    const provider = await getNahmiiProvider();

    return new nahmii.Wallet(signer.privateKey, provider);
}

async function getRandomWallet () {
    const signer = ethers.Wallet.createRandom();
    const provider = await getNahmiiProvider();

    return new nahmii.Wallet(signer.privateKey, provider);
}

function add (a, b) {
    a = Number.parseFloat(a);
    b = Number.parseFloat(b);

    return (a + b).toString();
}

function sub (a, b) {
    a = Number.parseFloat(a);
    b = Number.parseFloat(b);

    return (a - b).toString();
}

function eq(a, b) {
    a = Number.parseFloat(a);
    b = Number.parseFloat(b);
    const aa = Math.abs(a);
    const ab = Math.abs(b);
    const am = Math.max(aa, ab);
    const e = 0.00001 * am;
    const d = (a < b) ? (b - a) : (a - b);

    return d <= e;
}

module.exports = {
    getNahmiiConfig,
    getNahmiiProvider,
    delay12Blocks,
    add, sub, eq,
    getConfigWallet,
    getRandomWallet
};
