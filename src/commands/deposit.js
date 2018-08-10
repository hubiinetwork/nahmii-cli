'use strict';

const ethers = require('ethers');
const {prefix0x} = require('../sdk/utils');

module.exports = {
    command: 'deposit <amount> <currency> [--gas=<gaslimit>]',
    describe: 'Deposits <amount> of ETH (or any supported token) into your striim account.',
    builder: yargs => {
        yargs.example('deposit 1 ETH', 'Deposits 1 Ether using default gas limit.');
        yargs.example('deposit 1 ETH --gas=500000', 'Deposits 1 Ether and sets the gas limit to 500000.');
        yargs.example('deposit 1000 HBT', 'Deposits 1000 Hubiits (HBT) using default gas limit.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Deposits can be 1 or more transactions depending on the type of currency.',
            default: 250000,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const config = require('../config');

        ensureAmountIsPositiveNumber(argv.amount);

        const gasLimit = parseInt(argv.gas);
        if (gasLimit <= 0)
            throw new Error('Gas limit must be a number higher than 0');

        const secret = config.wallet.secret;
        const privateKey = prefix0x(config.privateKey(secret));

        let network = 'homestead';
        if (config.ethereum && config.ethereum.node)
            network = config.ethereum.node;
        dbg('Network: ' + network);

        let provider;
        if (config.ethereum && config.ethereum.node)
            provider = new ethers.providers.JsonRpcProvider(config.ethereum.node, config.ethereum.network);
        else
            provider = ethers.providers.getDefaultProvider(config.ethereum.network);
        dbg(JSON.stringify(provider));

        try {
            await isProviderConnected(provider);
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to connect to provider!');
        }

        const Wallet = require('../sdk/wallet');
        const wallet = new Wallet(privateKey, provider);

        if (argv.currency.toUpperCase() === 'ETH') {
            const receipt = await wallet.depositEth(argv.amount, {gasLimit});
            console.log(JSON.stringify([reduceReceipt(receipt)]));
        }
        else {
            const {createApiToken} = require('../sdk/identity-model');
            provider.apiAccessToken = await createApiToken();
            const receipts = await wallet.depositToken(argv.amount, argv.currency, {gasLimit});
            console.log(JSON.stringify(receipts.map(reduceReceipt)));
        }
    }
};

function ensureAmountIsPositiveNumber(amount) {
    if (typeof amount !== 'number')
        throw new TypeError('amount must be a number');
    if (amount <= 0)
        throw new Error('amount must be greater than zero');
}

function reduceReceipt(txReceipt) {
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}

let isProviderConnected = async function(provider) {
    await provider.getBlockNumber();
    return true;
};

function dbg(...args) {
    if (process.env.LOG_LEVEL === 'debug')
        console.error(...args);
}
