'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const moment = require('moment');
const ora = require('ora');

module.exports = {
    command: 'settle <stageAmount> <currency>',
    describe: 'Start settlement challenge',
    builder: {},
    handler: async (argv) => {
        const config = require('../config');
        const provider = new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);

        const { stageAmount, currency } = argv;

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const amount = new nahmii.MonetaryAmount(ethers.utils.parseUnits(stageAmount, tokenInfo.decimals), tokenInfo.currency, 0);
            const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const settlement = new nahmii.Settlement(provider);

            spinner = ora('Starting new settlement challenges').start();
            const txs = await settlement.startChallenge(amount, wallet)

            spinner.info(`Started ${txs.length} settlement(s) challenge.`);

            for (let tx of txs) {
                spinner.succeed(`Waiting for transaction to be mined; Settlement type:${tx.type}, hash:${tx.tx.hash}`).start();
                await provider.getTransactionConfirmation(tx.tx.hash);
                spinner.succeed(`Successfully started ${tx.type} settlement challenge`)
            }

            spinner.succeed('Loading challenge details').start();
            const challengeTime = await settlement.getMaxCurrentExpirationTime(wallet.address, tokenInfo.currency, 0)
            spinner.succeed(`The end time for the challenges is ${moment(challengeTime).format('dddd, MMMM Do YYYY, h:mm:ss a')}`)
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to start settlement challenge.');
        }
        finally {
            spinner.stop();
        }
    }
};
