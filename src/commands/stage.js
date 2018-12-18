'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');
const moment = require('moment');

module.exports = {
    command: 'stage <currency>  [--gas=<gaslimit>]',
    describe: 'Stage all qualified settlement challenges for <currency>',
    builder: yargs => {
        yargs.example('stage ETH', 'Stage all settlement challenges for <currency>');
        yargs.example('stage HBT', 'Stage all settlement challenges for <currency>');
    },
    handler: async (argv) => {
        const { currency, gas } = argv;

        const config = require('../config');
        const provider = new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const gasLimit = parseInt(gas) || null;

            let wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const settlement = new nahmii.Settlement(provider);
            spinner = ora('Settling qualified challenges').start();

            const {settleableChallenges, invalidReasons} = await settlement.getSettleableChallenges(wallet.address, tokenInfo.currency, 0);
            invalidReasons.forEach(challenge => {
                dbg(`\ncan not stage for type: ${challenge.type}`);
                challenge.reasons.forEach(reason => dbg('reason:', reason));
            });

            if (!settleableChallenges.length) {
                spinner.warn('There are no qualified challenges to stage the balance. Please check if the ongoing challenges have expired.');
                spinner.start('Checking ongoing challenges.').start();
                const ongoingChallenges = await settlement.getOngoingChallenges(wallet.address, tokenInfo.currency, 0);
                if (!ongoingChallenges.length) {
                    spinner.info('There are no ongoing challenges.');
                    return;
                }

                spinner.info('Ongoing challenges:');
                for (let ongoingChallenge of ongoingChallenges) {
                    const {type, expirationTime, intendedStageAmount} = ongoingChallenge;
                    const {amount} = intendedStageAmount.toJSON();
                    const formattedStageAmount = ethers.utils.formatUnits(amount, tokenInfo.decimals);
                    spinner.info(`type: ${type}; Stage amount: ${formattedStageAmount}; Expiration time: ${moment(expirationTime).toISOString()}`);
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
                spinner.info(`Starting ${type} settlement challenge with stage amount ${formattedStageAmount} ${currency}.`);

                const currentTx = await settlement.settleBySettleableChallenge(settleableChallenge, wallet, {gasLimit});
                spinner.start(`Waiting for transaction ${currentTx.hash} to be mined`).start();

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
