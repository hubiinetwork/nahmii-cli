'use strict';

const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');
const dbg = require('../dbg');
const utils = require('../utils');

module.exports = {
    command: 'settle <amount> <currency> [--gas=<gasLimit>] [--price=<gasPrice in gwei>]',
    describe: 'Start settlement(s) for <amount> <currency>',
    builder: yargs => {
        yargs.example('settle 1 ETH', 'Start settlement(s) for 1 Ether using default gas limit and price.');
        yargs.example('settle 1 ETH --gas=500000', 'Start settlement(s) for 1 Ether and sets gas limit to 500000 while using default gas price.');
        yargs.example('settle 0 ETH --price=2', 'Start settlement(s) for 0 Ether and sets gas price to 2 Gwei while using default gas limit.');
        yargs.example('settle 1000 HBT', 'Start settlement(s) for 1000 Hubiits (HBT) using default gas limit and price.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Settles can be 1 or more transactions depending on the stage amount.',
            default: 6000000,
            type: 'number'
        });
        yargs.option('price', {
            desc: 'Gas price used _per transaction_. Settles can be 1 or more transactions depending on the stage amount.',
            default: 1,
            type: 'number'
        });
        yargs.coerce('amount', arg => arg);
    },
    handler: async (argv) => {
        const { currency } = argv;
        const config = require('../config');

        let provider;
        const spinner = ora();
        try {
            provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
            const tokenInfo = await provider.getTokenInfo(currency);
            const amount = utils.parseAmount(argv.amount, tokenInfo.decimals);
            const gasLimit = utils.parsePositiveInteger(argv.gas);
            const gasPriceInGwei = utils.parsePositiveInteger(argv.price);
            const gasPrice = ethers.utils.bigNumberify(gasPriceInGwei).mul(ethers.utils.bigNumberify(10).pow(9));

            const stageMonetaryAmount = nahmii.MonetaryAmount.from(amount.toString(), tokenInfo.currency);
            const privateKey = await config.privateKey(config.wallet.secret);
            const wallet = new nahmii.Wallet(privateKey, provider);
            const settlement = new nahmii.SettlementFactory(provider);
            const balances = await wallet.getNahmiiBalance();
            const balance = balances[currency];
            if (!balance) {
                spinner.fail(`No nahmii balance available for ${currency}`);
                return;
            }

            const balanceBN = ethers.utils.parseUnits(balance, tokenInfo.decimals);
            if (balanceBN.lt(amount)) {
                spinner.fail(`The maximum settleable nahmii balance is ${balance}`);
                return;
            }

            spinner.start('Checking incompleted settlement(s)');
            const registeredSettlements = await settlement.getAllSettlements(wallet.address, tokenInfo.currency);
            const incompletedSettlements = registeredSettlements.filter(s => !s.isCompleted);
            spinner.info(`Has ${incompletedSettlements.length} incompleted settlement(s):`);
            incompletedSettlements.forEach(s => {
                console.log(JSON.stringify({...s.toJSON(), expirationTime: new Date(s.expirationTime).toISOString()}, undefined, 2));
            });
            
            spinner.start('Calculating the required settlement(s) for the intended stage amount');
            const requiredSettlements = await settlement.calculateRequiredSettlements(wallet.address, stageMonetaryAmount);
            spinner.info(`Need to start ${requiredSettlements.length} settlement(s).`);

            for (const requiredSettlement of requiredSettlements) {
                const formattedStageAmount = ethers.utils.formatUnits(requiredSettlement.stageAmount, tokenInfo.decimals);
                spinner.info(`Starting ${requiredSettlement.type} settlement with stage amount ${formattedStageAmount} ${currency}.`);
                const {hash} = await requiredSettlement.start(wallet, {gasLimit, gasPrice});
                spinner.start(`Waiting for transaction ${hash} to be mined`);

                const txReceipt = await provider.getTransactionConfirmation(hash, 300);
                spinner.succeed(`Successfully started settlement: ${hash} [gas used: ${ethers.utils.bigNumberify(txReceipt.gasUsed).toString()}]`);
            }
        }
        catch (err) {
            dbg(err);
            spinner.warn('Can not prepare for new settlement(s). Please check if there are incompleted settlements.');
            throw new Error(`Unable to start settlement: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};
