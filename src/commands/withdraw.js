'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

module.exports = {
    command: 'withdraw <amount> <currency>',
    describe: 'withdraw <amount> of ETH (or any supported token) from your nahmii account.',
    builder: yargs => {
        yargs.example('withdraw 1 ETH', 'Withdraw 1 Ether');
        yargs.example('withdraw 1000 HBT', 'Withdraw 1000 Hubiits (HBT)');
    },
    handler: async (argv) => {
        const config = require('../config');
        const {amount, currency} = argv;

        const provider = await new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const monetaryAmount = new nahmii.MonetaryAmount(ethers.utils.parseUnits(amount, tokenInfo.decimals), tokenInfo.currency, 0);
            spinner.start('Waiting for transaction to be broadcast').start();
            const request = await wallet.withdraw(monetaryAmount);
            spinner.succeed(`Transaction broadcast ${request.hash}`);
            spinner.start('Waiting for transaction to be mined').start();
            const txReceipt = await provider.getTransactionConfirmation(request.hash);
            spinner.succeed('Transaction mined');
            console.log(JSON.stringify([reduceReceipt(txReceipt)]));
        }
        catch (err) {
            dbg(err);
            throw new Error(`Withdraw failed: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};

function reduceReceipt(txReceipt) {
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}
