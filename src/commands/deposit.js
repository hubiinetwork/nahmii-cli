'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

module.exports = {
    command: 'deposit <amount> <currency> [--gas=<gaslimit> --price=<gasPrice in gwei>]',
    describe: 'Deposits <amount> of ETH (or any supported token) into your nahmii account.',
    builder: yargs => {
        yargs.example('deposit 1 ETH', 'Deposits 1 Ether using default gas limit.');
        yargs.example('deposit 1 ETH --gas=500000', 'Deposits 1 Ether and sets the gas limit to 500000.');
        yargs.example('deposit 1000 HBT', 'Deposits 1000 Hubiits (HBT) using default gas limit.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Deposits can be 1 or more transactions depending on the type of currency.',
            default: 600000,
            type: 'number'
        });
        yargs.coerce('amount', arg => arg); // Coerce it to remain a string
    },
    handler: async (argv) => {
        const amount = validateAmount(argv.amount);
        const gasLimit = validateGasLimit(argv.gas);
        const gasPriceInGwei = validateGasLimit(argv.price);
        const gasPrice = argv.price ? ethers.utils.bigNumberify(gasPriceInGwei).mul(ethers.utils.bigNumberify(10).pow(9)) : null;

        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

        let spinner = ora();
        try {
            if (argv.currency.toUpperCase() === 'ETH') {
                spinner.start('Waiting for transaction to be broadcast');
                const { hash } = await wallet.depositEth(amount, {gasLimit, gasPrice});
                spinner.succeed(`Transaction broadcast ${hash}`);

                spinner.start('Waiting for transaction to be mined');
                const receipt = await provider.getTransactionConfirmation(hash);
                spinner.succeed('Transaction mined');

                console.log(JSON.stringify([reduceReceipt(receipt)]));
            }
            else {
                spinner.start('Waiting for transaction 1/2 to be broadcast');
                const pendingApprovalTx = await wallet.approveTokenDeposit(argv.amount, argv.currency, {gasLimit, gasPrice});
                spinner.succeed(`Transaction 1/2 broadcast ${pendingApprovalTx.hash}`);

                spinner.start('Waiting for transaction 1/2 to be mined');
                const approveReceipt = await provider.getTransactionConfirmation(pendingApprovalTx.hash, 180);
                spinner.succeed('Transaction 1/2 mined');

                spinner.start('Waiting for transaction 2/2 to be broadcast').start();
                const pendingCompleteTx = await wallet.completeTokenDeposit(argv.amount, argv.currency, {gasLimit, gasPrice});
                spinner.succeed(`Transaction 2/2 broadcast ${pendingCompleteTx.hash}`);

                spinner.start('Waiting for transaction 2/2 to be mined');
                const completeReceipt = await provider.getTransactionConfirmation(pendingCompleteTx.hash, 180);
                spinner.succeed('Transaction 2/2 mined');

                console.log(JSON.stringify([reduceReceipt(approveReceipt), reduceReceipt(completeReceipt)]));
            }
        }
        catch (err) {
            dbg(err);
            spinner.fail('Something went wrong');
            throw new Error(`Deposit failed: ${err.message}`);
        }
        finally {
            provider.stopUpdate();
        }
    }
};

function validateAmount(amount) {
    let amountBN;
    try {
        amountBN = ethers.utils.parseEther(amount);
    }
    catch (err) {
        dbg(err);
        throw new TypeError('Amount must be a number!');
    }

    if (amountBN.eq(0))
        throw new Error('Amount must be greater than zero!');

    return amount;
}

function validateGasLimit(gas) {
    const gasLimit = parseInt(gas);
    if (gasLimit <= 0)
        throw new Error('Gas limit must be a number higher than 0');
    return gasLimit;
}

function reduceReceipt(txReceipt) {
    // TODO: Fix links when on mainnet
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}
