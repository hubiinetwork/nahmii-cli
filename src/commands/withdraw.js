'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

module.exports = {
    command: 'withdraw <amount> <currency> [--gas=<gaslimit>] [--price=<gasPrice in gwei>]',
    describe: 'withdraw <amount> of ETH (or any supported token) from your nahmii account.',
    builder: yargs => {
        yargs.example('withdraw 1 ETH', 'Withdraws 1 Ether');
        yargs.example('withdraw 1 ETH --gas=500000', 'Withdraws 1 Ether and sets gas limit to 500000 while using default gas price.');
        yargs.example('withdraw 1 ETH --price=2', 'Withdraws 1 Ether and sets gas price to 2 Gwei while using default gas limit.');
        yargs.example('withdraw 1000 HBT', 'Withdraws 1000 Hubiits (HBT)');
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
        const {amount, currency, gas, price} = argv;

        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

        let spinner = ora();
        try {
            const tokenInfo = await provider.getTokenInfo(currency);
            const gasLimit = parseInt(gas) || null;
            const gasPrice = ethers.utils.bigNumberify(price).mul(ethers.utils.bigNumberify(10).pow(9));

            const withdrawAmountBN = ethers.utils.parseUnits(amount, tokenInfo.decimals);
            const withdrawMonetaryAmount = nahmii.MonetaryAmount.from(withdrawAmountBN, tokenInfo.currency);
            
            const stagedBalanceBN = await wallet.getNahmiiStagedBalance(tokenInfo.symbol);
            
            if (withdrawAmountBN.gt(stagedBalanceBN)) {
                spinner.fail(`The maximum withdrawal nahmii balance is ${ethers.utils.formatUnits(stagedBalanceBN, tokenInfo.decimals)}`);
                return;
            }

            spinner.start('Waiting for transaction to be broadcast');

            const request = await wallet.withdraw(withdrawMonetaryAmount, {gasLimit, gasPrice});
            spinner.succeed(`Transaction broadcast ${request.hash}`);
            spinner.start('Waiting for transaction to be mined');
            const txReceipt = await provider.getTransactionConfirmation(request.hash);
            spinner.succeed('Transaction mined');
            console.log(JSON.stringify([reduceReceipt(txReceipt)]));
        }
        catch (err) {
            dbg(err);
            throw new Error(`Withdraw failed: ${err.message}`);
        }
        finally {
            spinner.stop();
            provider.stopUpdate();
        }
    }
};

function reduceReceipt(txReceipt) {
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}
