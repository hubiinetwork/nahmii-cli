'use strict';

const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');
const dbg = require('../dbg');
const utils = require('../utils');

module.exports = {
    command: 'stage <currency>  [--gas=<gaslimit>] [--price=<gasPrice in gwei>]',
    describe: 'Stage all qualified settlement(s) for <currency>',
    builder: yargs => {
        yargs.example('stage ETH', 'Stages qualified settlement(s) for ETH using default gas limit and price.');
        yargs.example('stage ETH --gas=500000', 'Stages qualified settlement(s) for ETH and sets gas limit to 500000 while using default gas price.');
        yargs.example('stage ETH --price=2', 'Stages qualified settlement(s) for ETH and sets gas price to 2 Gwei while using default gas limit.');
        yargs.example('stage HBT', 'Stages qualified settlement(s) for HBT using default gas limit and price.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Stages can be 1 or more transactions depending on the number of qualified settlement(s).',
            default: 6000000,
            type: 'number'
        });
        yargs.option('price', {
            desc: 'Gas price used _per transaction_. Stages can be 1 or more transactions depending on the number of qualified settlement(s).',
            default: 1,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const { currency } = argv;
        const config = require('../config');
        let provider;        
        const spinner = ora();
        try {
            provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
            const tokenInfo = await provider.getTokenInfo(currency);
            const gasLimit = utils.parsePositiveInteger(argv.gas);
            const price = utils.parsePositiveInteger(argv.price);
            const gasPrice = ethers.utils.bigNumberify(price).mul(ethers.utils.bigNumberify(10).pow(9));
            
            const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const settlement = new nahmii.SettlementFactory(provider);
            spinner.start('Staging qualified settlement(s)');
            
            const settlements = await settlement.getAllSettlements(wallet.address, tokenInfo.currency);
            const stageableSettlements = settlements.filter(s => s.isStageable);
            const ongoingSettlements = settlements.filter(s => s.isOngoing);

            if (!stageableSettlements.length) {
                spinner.warn('There are no settlements ready to be staged. Please check if the ongoing settlement(s) have expired.');
                if (!ongoingSettlements.length) {
                    spinner.info('There are no ongoing settlement(s).');
                    return;
                }
                
                spinner.info('Ongoing settlement(s):');
                for (const ongoingSettlement of ongoingSettlements) {
                    const {type, expirationTime, stageAmount} = ongoingSettlement;
                    const formattedStageAmount = ethers.utils.formatUnits(stageAmount, tokenInfo.decimals);
                    spinner.info(`Type: ${type}; Stage amount: ${formattedStageAmount}; Expiration time: ${new Date(expirationTime).toISOString()}`);
                }
                return;
            }
            
            let totalIntendedStageAmount = stageableSettlements.reduce((accumulator, settlement) => {
                return accumulator.add(settlement.stageAmount);
            }, ethers.utils.bigNumberify(0));
            totalIntendedStageAmount = ethers.utils.formatUnits(totalIntendedStageAmount, tokenInfo.decimals);

            spinner.info(`There are ${stageableSettlements.length} settlement(s) ready to be staged with total stage amount ${totalIntendedStageAmount}`);

            for (const stageableSettlement of stageableSettlements) {
                const {type, stageAmount} = stageableSettlement;
                const formattedStageAmount = ethers.utils.formatUnits(stageAmount, tokenInfo.decimals);
                spinner.info(`Staging ${type} settlement with stage amount ${formattedStageAmount} ${currency}.`);

                const tx = await stageableSettlement.stage(wallet, {gasLimit, gasPrice});
                spinner.start(`Waiting for transaction ${tx.hash} to be mined`);

                const txReceipt = await provider.getTransactionConfirmation(tx.hash, 300);
                spinner.succeed(`Updated stage balance(max withdrawal amount). [used gas: ${ethers.utils.bigNumberify(txReceipt.gasUsed).toString()}]`);
            }
        }
        catch (err) {
            dbg(err);
            throw new Error(`Unable to stage settlement: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};
