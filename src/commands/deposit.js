'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

module.exports = {
    command: 'deposit <amount> <currency> [--gas=<gaslimit>] [--timeout=<seconds>]',
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
        yargs.options('timeout', {
            desc: 'Number of seconds to wait for each on-chain transaction to be mined.',
            default: 60,
            type: 'number'
        });
        yargs.coerce('amount', arg => arg); // Coerce it to remain a string
    },
    handler: async (argv) => {
        const amount = validateAmount(argv.amount);
        const gasLimit = validateGasLimit(argv.gas);
        const timeout = validateTimeout(argv.timeout);
        const currencySymbol = argv.currency;

        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

        let spinner = ora();
        try {
            if (currencySymbol.toUpperCase() === 'ETH') {
                spinner.start('Waiting for transaction to be broadcast');
                const {hash} = await wallet.depositEth(amount, {gasLimit});
                spinner.succeed(`Transaction broadcast ${hash}`);

                spinner.start('Waiting for transaction to be mined');
                const receipt = await provider.getTransactionConfirmation(hash, timeout);
                spinner.succeed('Transaction mined');

                console.log(JSON.stringify([reduceReceipt(receipt)]));
            }
            else {
                const tokenContract = await nahmii.Erc20Contract.from(currencySymbol, wallet);
                const decimals = await determineDecimals(tokenContract);
                const tokenBalanceBN = await tokenContract.balanceOf(config.wallet.address);
                const amountBN = ethers.utils.parseUnits(amount, decimals);

                dbg(`Network balance: ${ethers.utils.formatUnits(tokenBalanceBN, decimals)} ${currencySymbol}`);
                dbg(`Depositing: ${amount} ${currencySymbol}`);

                if (amountBN.lte(tokenBalanceBN)) {
                    spinner.start('Checking allowance');
                    const allowanceBN = await wallet.getDepositAllowance(currencySymbol);
                    spinner.succeed(`Current allowance: ${ethers.utils.formatUnits(allowanceBN, decimals)} ${currencySymbol}`);

                    let approveReceipt = null;

                    if (allowanceBN.lt(amountBN)) {
                        if (allowanceBN.gt(ethers.utils.bigNumberify(0))) {
                            spinner.start('Clearing allowance');
                            const pendingClearTx = await wallet.approveTokenDeposit(0, currencySymbol, {gasLimit});
                            spinner.succeed(`Allowance cleared - ${pendingClearTx.hash}`);

                            spinner.start('Confirming allowance is cleared');
                            await provider.getTransactionConfirmation(pendingClearTx.hash, timeout);
                            spinner.succeed('Allowance confirmed cleared');
                        }

                        spinner.start(`Approving transfer of ${amount} ${currencySymbol}`);
                        const pendingApprovalTx = await wallet.approveTokenDeposit(amount, currencySymbol, {gasLimit});
                        spinner.succeed(`Transfer approval registered - ${pendingApprovalTx.hash}`);

                        spinner.start('Confirming transfer approval');
                        approveReceipt = await provider.getTransactionConfirmation(pendingApprovalTx.hash, timeout);
                        spinner.succeed('Transfer approval confirmed');
                    }

                    spinner.start('Registering nahmii deposit');
                    const pendingDepositTx = await wallet.completeTokenDeposit(amount, currencySymbol, {gasLimit});
                    spinner.succeed(`nahmii deposit registered - ${pendingDepositTx.hash}`);

                    spinner.start('Confirming nahmii deposit');
                    const completeReceipt = await provider.getTransactionConfirmation(pendingDepositTx.hash, timeout);
                    spinner.succeed(`nahmii deposit of ${amount} ${currencySymbol} confirmed`);

                    console.error('Please allow a few minutes for the nahmii balance to be updated!');

                    const output = [approveReceipt, completeReceipt].map(reduceReceipt);
                    console.log(JSON.stringify(output));
                }
                else {
                    console.error(`Insufficient funds! Your network balance is only ${ethers.utils.formatUnits(tokenBalanceBN, decimals)} ${currencySymbol}`);
                }
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

async function determineDecimals(contract) {
    const dBN = await contract.decimals();
    return dBN.toNumber();
}

function validateTimeout(timeout) {
    timeout = parseInt(timeout);
    if (timeout <= 0)
        throw new Error('Timeout must be a number higher than 0.');
    return timeout;
}

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
    if (!txReceipt)
        return null;

    // TODO: Fix links when on mainnet
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}
