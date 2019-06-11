'use strict';

const ethers = require('ethers');
const nahmii = require('nahmii-sdk');
const ora = require('ora');
const dbg = require('../dbg');
const utils = require('../utils');

module.exports = {
    command: 'unstage <amount> <currency> [--gas=<gaslimit>] [--price=<gasPrice in gwei>]',
    describe: 'unstage <amount> of ETH (or any supported token) from your nahmii account.',
    builder: yargs => {
        yargs.example('unstage 1 ETH', 'unstages 1 Ether');
        yargs.example('unstage 1 ETH --gas=500000', 'unstages 1 Ether and sets gas limit to 500000 while using default gas price.');
        yargs.example('unstage 1 ETH --price=2', 'unstages 1 Ether and sets gas price to 2 Gwei while using default gas limit.');
        yargs.example('unstage 1000 HBT', 'unstages 1000 Hubiits (HBT)');
        yargs.option('gas', {
            desc: 'Gas limit used',
            default: 600000,
            type: 'number'
        });
        yargs.option('price', {
            desc: 'Gas price used',
            default: 1,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const config = require('../config');

        let provider;
        const spinner = ora();
        try {
            provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
            const tokenInfo = await provider.getTokenInfo(argv.currency);
            
            const amount = utils.parseAmount(argv.amount, tokenInfo.decimals);
            const gasLimit = utils.parsePositiveInteger(argv.gas);
            const gasPriceInGwei = utils.parsePositiveInteger(argv.price);
            const gasPrice = ethers.utils.bigNumberify(gasPriceInGwei).mul(ethers.utils.bigNumberify(10).pow(9));
            const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

            const unstageMonetaryAmount = nahmii.MonetaryAmount.from(amount, tokenInfo.currency);
            const stagedBalanceBN = await wallet.getNahmiiStagedBalance(tokenInfo.symbol);
            
            if (amount.gt(stagedBalanceBN)) {
                spinner.fail(`The maximum unstage amount is ${ethers.utils.formatUnits(stagedBalanceBN, tokenInfo.decimals)}`);
                return;
            }

            spinner.start('Waiting for transaction to be broadcast');

            const request = await wallet.unstage(unstageMonetaryAmount, {gasLimit, gasPrice});
            spinner.succeed(`Transaction broadcast ${request.hash}`);
            spinner.start('Waiting for transaction to be mined');
            const txReceipt = await provider.getTransactionConfirmation(request.hash);
            spinner.succeed('Transaction mined');
            console.log(JSON.stringify([utils.reduceReceipt(txReceipt)]));
        }
        catch (err) {
            dbg(err);
            throw new Error(`Unstage failed: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};
