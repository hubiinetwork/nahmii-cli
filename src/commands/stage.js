'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers')
const ora = require('ora');

module.exports = {
    command: 'stage <currency>',
    describe: 'Settle a qualified challenge',
    builder: {},
    handler: async (argv) => {
        const config = require('../config');
        const provider = new nahmii.NahmiiProvider(config.apiRoot, config.appId, config.appSecret);

        const { currency } = argv;

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            let wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
            const settlement = new nahmii.Settlement(provider);
            spinner = ora('Settling qualified challenges').start();
            const txs = await settlement.settle(tokenInfo.currency, 0, wallet)
            if (!txs.length) {
                spinner.warn('There are no valid qualified challenges to stage the balance.')
                return;
            }
            spinner.info(`There are ${txs.length} settlement(s) ready to be staged.`);
            for (let tx of txs) {
                spinner.succeed('Waiting for transaction to be mined').start();
                await provider.getTransactionConfirmation(tx.tx.hash)
                spinner.succeed(`Settled ${tx.type} settlement challenge;`)
            }
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
