'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');

module.exports = {
    command: 'deposit <amount> <currency> [--gas=<gaslimit>]',
    describe: 'Deposits <amount> of ETH (or any supported token) into your nahmii account.',
    builder: yargs => {
        yargs.example('deposit 1 ETH', 'Deposits 1 Ether using default gas limit.');
        yargs.example('deposit 1 ETH --gas=500000', 'Deposits 1 Ether and sets the gas limit to 500000.');
        yargs.example('deposit 1000 HBT', 'Deposits 1000 Hubiits (HBT) using default gas limit.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Deposits can be 1 or more transactions depending on the type of currency.',
            default: 250000,
            type: 'number'
        });
        yargs.coerce('amount', arg => arg); // Coerce it to remain a string
    },
    handler: async (argv) => {
        const amount = validateAmountIsPositiveDecimalNumber(argv.amount);
        const gasLimit = validateGasLimitIsPositiveInteger(argv.gas);

        const config = require('../config');
        const provider = await new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

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
    let amountBN;
    try {
        amountBN = ethers.utils.parseEther(amount);
    }
    catch(err) {
        dbg(err);
        throw new TypeError('Amount must be a number!');
    }

    if (amountBN.eq(0))
        throw new Error('Amount must be greater than zero!');

    return amount;
}

let validateGasLimitIsPositiveInteger = function(gas) {
    const gasLimit = parseInt(gas);
    if (gasLimit <= 0)
        throw new Error('Gas limit must be a number higher than 0');
    return gasLimit;
};

function reduceReceipt(txReceipt) {
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}
