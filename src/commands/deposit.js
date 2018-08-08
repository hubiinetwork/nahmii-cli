'use strict';

const web3utils = require('web3-utils');
const Web3Eth = require('web3-eth');

module.exports = {
    command: 'deposit <amount> <currency> [--gas=<gaslimit>]',
    describe: 'Deposits <amount> of Ether (or any supported token) into your striim account.',
    builder: yargs => {
        yargs.example('deposit 1 ETH', 'Deposits 1 Ether using default gas limit.');
        yargs.example('deposit 1 ETH --gas=200000', 'Deposits 1 Ether and sets the gas limit to 200000.');
        yargs.example('deposit 1000 HBT', 'Deposits 1000 Hubiits (HBT) using default gas limit.');
        yargs.option('gas', {
            desc: 'Gas limit',
            default: 100000,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const {createApiToken} = require('../sdk/identity-model');
        const config = require('../config');

        const eth = new Web3Eth(config.ethereum.node);

        if (argv.currency.toUpperCase() !== 'ETH')
            throw new Error('ETH is the only supported currency at the moment');

        const gasLimit = parseInt(argv.gas);
        if (gasLimit <= 0)
            throw new Error('Gas limit must be a number higher than 0');

        const nonce = await eth.getTransactionCount(config.wallet.address);
        console.error('Last nonce: ' + nonce);

        const gasPrice = await eth.getGasPrice();
        console.error(`Current gas price is: ${gasPrice} wei`);


        const tx = {
            from: config.wallet.address,
            to: config.ethereum.clientFund.toString(),
            value: web3utils.toWei(argv.amount.toString(), 'ether'),
            gas: argv.gas.toString(),
            gasPrice: gasPrice,
            nonce: nonce
        };

        console.error(tx);

        const secret = config.wallet.secret;
        const privateKey = config.privateKey(secret);

        let signedTx = await eth.signTransaction(tx, privateKey);

        console.error(signedTx);

//        let receipt = await eth.sendTransaction(tx);


//        try {
//            let token = await createApiToken();
//        }
//        catch (err) {
//            throw new Error('Unable to authenticate using current configuration.');
//        }
    }
};
