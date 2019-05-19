'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

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
            default: 600000,
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
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const tokenInfo = await provider.getTokenInfo(currency);
        const gasLimit = validatePositiveInteger(argv.gas);
        const price = validatePositiveInteger(argv.price);
        const gasPrice = ethers.utils.bigNumberify(price).mul(ethers.utils.bigNumberify(10).pow(9));

        let spinner = ora();
        try {
            
            let wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const settlement = new nahmii.Settlement(provider);
            spinner.start('Staging qualified settlement(s)');
            
            const {settleableChallenges, invalidReasons} = await settlement.getSettleableChallenges(wallet.address, tokenInfo.currency, 0);
            invalidReasons.forEach(challenge => {
                dbg(`\ncan not stage for type: ${challenge.type}`);
                challenge.reasons.forEach(reason => dbg('reason:', reason));
            });
            
            if (!settleableChallenges.length) {
                spinner.warn('There are no qualified settlement(s) to stage the balance. Please check if the ongoing settlement(s) have expired.');
                spinner.start('Checking ongoing settlement(s).');
                const ongoingChallenges = await settlement.getOngoingChallenges(wallet.address, tokenInfo.currency, 0);
                if (!ongoingChallenges.length) {
                    spinner.info('There are no ongoing settlement(s).');
                    return;
                }
                
                spinner.info('Ongoing settlement(s):');
                for (let ongoingChallenge of ongoingChallenges) {
                    const {type, expirationTime, intendedStageAmount} = ongoingChallenge;
                    const {amount} = intendedStageAmount.toJSON();
                    const formattedStageAmount = ethers.utils.formatUnits(amount, tokenInfo.decimals);
                    spinner.info(`Type: ${type}; Stage amount: ${formattedStageAmount}; Expiration time: ${new Date(expirationTime).toISOString()}`);
                }
                return;
            }
            
            let totalIntendedStageAmount = settleableChallenges.reduce((accumulator, tx) => {
                const amount = ethers.utils.bigNumberify(tx.intendedStageAmount.toJSON().amount);
                return accumulator.add(amount);
            }, ethers.utils.bigNumberify(0));
            totalIntendedStageAmount = ethers.utils.formatUnits(totalIntendedStageAmount, tokenInfo.decimals);

            spinner.info(`There are ${settleableChallenges.length} settlement(s) ready to be staged with total stage amount ${totalIntendedStageAmount}`);

            for (let settleableChallenge of settleableChallenges) {
                const {type, intendedStageAmount} = settleableChallenge;
                const {amount} = intendedStageAmount.toJSON();
                const formattedStageAmount = ethers.utils.formatUnits(amount, tokenInfo.decimals);
                spinner.info(`Staging ${type} settlement with stage amount ${formattedStageAmount} ${currency}.`);

                const currentTx = await settlement.settleBySettleableChallenge(settleableChallenge, wallet, {gasLimit, gasPrice});
                spinner.start(`Waiting for transaction ${currentTx.hash} to be mined`);

                const txReceipt = await provider.getTransactionConfirmation(currentTx.hash, 300);
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

function validatePositiveInteger(str) {
    const number = parseInt(str);
    if (number <= 0)
        throw new Error('Gas limit/price must be a number higher than 0');
    return number;
}