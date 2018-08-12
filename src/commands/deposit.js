'use strict';

const striim = require('../sdk');


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
        const amount = validateAmountIsPositiveDecimalNumber(argv.amount);
        const gasLimit = validateGasLimitIsPositiveInteger(argv.gas);

        const config = require('../config');
        const provider = await createProvider(config);
        const wallet = new striim.Wallet(config.privateKey(config.wallet.secret), provider);

        if (argv.currency.toUpperCase() === 'ETH') {
            const receipt = await wallet.depositEth(amount, {gasLimit});
            console.log(JSON.stringify([reduceReceipt(receipt)]));
        }
        else {
            const receipts = await wallet.depositToken(argv.amount, argv.currency, {gasLimit});
            console.log(JSON.stringify(receipts.map(reduceReceipt)));
        }
    }
};

function validateAmountIsPositiveDecimalNumber(amount) {
    if (typeof amount !== 'number')
        throw new TypeError('amount must be a number');
    if (amount <= 0)
        throw new Error('amount must be greater than zero');

    return amount;
}

let validateGasLimitIsPositiveInteger = function(gas) {
    const gasLimit = parseInt(gas);
    if (gasLimit <= 0)
        throw new Error('Gas limit must be a number higher than 0');
    return gasLimit;
};

async function createProvider(config) {
    let network = 'homestead';
    if (config.ethereum && config.ethereum.network)
        network = config.ethereum.network;
    dbg('Network: ' + network);

    let provider = new striim.StriimProvider(config.apiRoot, config.appId, config.appSecret, config.ethereum.node, network);

    try {
        await Promise.all([
            provider.getBlockNumber(),
            provider.getApiAccessToken()
        ]);
    }
    catch (err) {
        dbg(err);
        throw new Error('Unable to connect to network!');
    }
    return provider;
}

function reduceReceipt(txReceipt) {
    const ethers = require('ethers');

    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}

function dbg(...args) {
    if (process.env.LOG_LEVEL === 'debug')
        console.error(...args);
}