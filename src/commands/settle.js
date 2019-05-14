'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

module.exports = {
    command: 'settle <amount> <currency> [--gas=<gasLimit>] [--price=<gasPrice in gwei>]',
    describe: 'Start settlement(s) for <amount> <currency>',
    builder: yargs => {
        yargs.example('settle 1 ETH', 'Start settlement(s) for 1 Ether using default gas limit and price.');
        yargs.example('settle 1 ETH --gas=500000', 'Start settlement(s) for 1 Ether and sets gas limit to 500000 while using default gas price.');
        yargs.example('settle 1 ETH --price=2', 'Start settlement(s) for 1 Ether and sets gas price to 2 Gwei while using default gas limit.');
        yargs.example('settle 1000 HBT', 'Start settlement(s) for 1000 Hubiits (HBT) using default gas limit and price.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Settles can be 1 or more transactions depending on the stage amount.',
            default: 600000,
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
        const { amount, currency, gas, price } = argv;
        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const gasLimit = parseInt(gas) || null;
            const gasPrice = price ? ethers.utils.bigNumberify(price).mul(ethers.utils.bigNumberify(10).pow(9)) : null;

            const stageAmountBN = ethers.utils.parseUnits(amount, tokenInfo.decimals);
            const stageMonetaryAmount = nahmii.MonetaryAmount.from(stageAmountBN, tokenInfo.currency);
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

            spinner.start('Calculating the required settlement(s) for the intended stage amount');
            const {requiredChallenges, invalidReasons} = await settlement.getRequiredChallengesForIntendedStageAmount(stageMonetaryAmount, wallet.address);
            invalidReasons.forEach(challenge => {
                dbg(`\ncan not settle for type: ${challenge.type}`);
                challenge.reasons.forEach(reason => dbg('reason:', reason));
            });

            if (requiredChallenges.length) {
                spinner.info(`Need to start ${requiredChallenges.length} settlement(s).`);
    
                for (let requiredChallenge of requiredChallenges) {
                    const {type, stageMonetaryAmount} = requiredChallenge;
                    const {amount} = stageMonetaryAmount.toJSON();
                    const formattedStageAmount = ethers.utils.formatUnits(amount, tokenInfo.decimals);
                    spinner.info(`Starting ${type} settlement with stage amount ${formattedStageAmount} ${currency}.`);
                    const currentTx = await settlement.startByRequiredChallenge(requiredChallenge, wallet, {gasLimit, gasPrice});
                    spinner.start(`Waiting for transaction ${currentTx.hash} to be mined`);
                    const txReceipt = await provider.getTransactionConfirmation(currentTx.hash, 300);
                    spinner.succeed(`Successfully started settlement: ${currentTx.hash} [gas used: ${ethers.utils.bigNumberify(txReceipt.gasUsed).toString()}]`);
                }
            }
            else {
                spinner.warn('Can not start new settlement(s). Please check if the ongoing settlement(s) have expired.');
            }

            spinner.start('Loading details for the ongoing settlement(s)');
            const maxChallengeTime = await settlement.getMaxChallengesTimeout(wallet.address, tokenInfo.currency, 0);
            if (maxChallengeTime) 
                spinner.info(`The end time for the ongoing settlement(s) is ${new Date(maxChallengeTime).toISOString()}`);
        }
        catch (err) {
            dbg(err);
            throw new Error(`Unable to start settlement: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};
