'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const moment = require('moment');
const ora = require('ora');

module.exports = {
    command: 'settle <stageAmount> <currency> [--gas=<gasLimit> --price=<gasPrice in gwei>]',
    describe: 'Start settlement challenges for <stageAmount> <currency> intended stage amount',
    builder: yargs => {
        yargs.example('settle 1 ETH', 'Start settlement challenges for 1 Ether intended stage amount');
        yargs.example('settle 1000 HBT', 'Start settlement challenges for 1000 Hubiits (HBT) intended stage amount');
    },
    handler: async (argv) => {
        const { stageAmount, currency, gas, price } = argv;
        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const gasLimit = parseInt(gas) || null;
            const gasPrice = price ? ethers.utils.bigNumberify(price).mul(ethers.utils.bigNumberify(10).pow(9)) : null;

            const stageAmountBN = ethers.utils.parseUnits(stageAmount, tokenInfo.decimals);
            const stageMonetaryAmount = new nahmii.MonetaryAmount(stageAmountBN, tokenInfo.currency, 0);
            const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const settlement = new nahmii.Settlement(provider);

            const balances = await wallet.getNahmiiBalance();
            const balance = balances[currency];
            if (!balance) {
                spinner.fail(`No nahmii balance available for ${currency}`);
                return;
            }

            const balanceBN = ethers.utils.parseUnits(balance, tokenInfo.decimals);

            if (balanceBN.lt(stageAmountBN)) {
                spinner.fail(`The maximum settleable nahmii balance is ${balance}`);
                return;
            }

            spinner = ora('Calculating the required settlement challenges for the intended stage amount').start();
            const {requiredChallenges, invalidReasons} = await settlement.getRequiredChallengesForIntendedStageAmount(stageMonetaryAmount, wallet.address);
            invalidReasons.forEach(challenge => {
                dbg(`\ncan not settle for type: ${challenge.type}`);
                challenge.reasons.forEach(reason => dbg('reason:', reason));
            });

            if (requiredChallenges.length) {
                spinner.info(`Need to start ${requiredChallenges.length} settlement(s) challenge.`);
    
                for (let requiredChallenge of requiredChallenges) {
                    const {type, stageMonetaryAmount} = requiredChallenge;
                    const {amount} = stageMonetaryAmount.toJSON();
                    const formattedStageAmount = ethers.utils.formatUnits(amount, tokenInfo.decimals);
                    spinner.info(`Starting ${type} settlement challenge with stage amount ${formattedStageAmount} ${currency}.`);
                    const currentTx = await settlement.startByRequiredChallenge(requiredChallenge, wallet, {gasLimit, gasPrice});
                    spinner.start(`Waiting for transaction ${currentTx.hash} to be mined`).start();
                    const txReceipt = await provider.getTransactionConfirmation(currentTx.hash, 300);
                    spinner.succeed(`Successfully started settlement challenge: ${currentTx.hash} [gas used: ${ethers.utils.bigNumberify(txReceipt.gasUsed).toString()}]`);
                }
            }
            else {
                spinner.warn('Can not start new challenges. Please check if the ongoing challenges have expired.');
            }

            spinner.start('Loading details for the ongoing challenges').start();
            const maxChallengeTime = await settlement.getMaxChallengesTimeout(wallet.address, tokenInfo.currency, 0);
            if (maxChallengeTime) 
                spinner.info(`The end time for the ongoing challenges is ${moment(maxChallengeTime).toISOString()}`);
        }
        catch (err) {
            dbg(err);
            throw new Error(`Unable to start settlement challenge: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};
