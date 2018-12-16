'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const moment = require('moment');
const ora = require('ora');

module.exports = {
    command: 'settle <stageAmount> <currency> [--gas=<gaslimit>]',
    describe: 'Start settlement challenges for <stageAmount> <currency> intended stage amount',
    builder: yargs => {
        yargs.example('settle 1 ETH', 'Start settlement challenges for 1 Ether intended stage amount');
        yargs.example('settle 1000 HBT', 'Start settlement challenges for 1000 Hubiits (HBT) intended stage amount');
    },
    handler: async (argv) => {
        const { stageAmount, currency, gas } = argv;
        const config = require('../config');
        const provider = new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);
        
        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const gasLimit = parseInt(gas) || null;

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

            spinner = ora('Starting new settlement challenges').start();
            const txs = await settlement.startChallenge(stageMonetaryAmount, wallet, {gasLimit});

            spinner.info(`Started ${txs.length} settlement(s) challenge.`);

            for (let confirmedTx of txs) {
                const {amount} = confirmedTx.intendedStageAmount.toJSON();
                const formattedStageAmount = ethers.utils.formatUnits(amount, tokenInfo.decimals);
                spinner.info(`Challenge details: \n type: ${confirmedTx.type}\n hash: ${confirmedTx.tx.transactionHash}\n amount: ${formattedStageAmount}`);
                spinner.succeed(`Successfully started ${confirmedTx.type} settlement challenge. [used gas: ${ethers.utils.bigNumberify(confirmedTx.tx.gasUsed).toString()}]`);
            }

            spinner.start('Loading details for the ongoing challenges').start();
            const maxChallengeTime = await settlement.getMaxChallengesTimeout(wallet.address, tokenInfo.currency, 0);
            if (maxChallengeTime) 
                spinner.info(`The end time for the ongoing challenges is ${moment(maxChallengeTime).toISOString()}`);
        }
        catch (err) {
            dbg(err);
            const possibleCauses = 'It could be caused by the fact that the nahmii balance has not yet been synchronized with the latest states of the contracts.';
            throw new Error(`Unable to start settlement challenge. Please try again few minutes later. [${possibleCauses}]`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};
