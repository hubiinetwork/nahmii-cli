'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

module.exports = {
    command: 'claim nii for period <period> [--gas=<gaslimit>]',
    describe: 'Claims NII tokens from the time locked revenue token manager and deposits all NII to nahmii. Will only work if wallet is beneficiary of contract.',
    builder: yargs => {
        yargs.example('claim nii for period 1', 'Claims NII tokens for time locked period 1 (December 2018).');
        yargs.option('gas', {
            desc: 'Gas limit used _per on-chain transaction_.',
            default: 800000,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const period = validatePeriod(argv.period);
        const gasLimit = validateGasLimit(argv.gas);
        const options = {gasLimit};

        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);
        const niiContract = await nahmii.Erc20Contract.from('NII', wallet);

        let spinner = ora();
        try {
            const RevenueTokenManagerContract = require('../contracts/revenue-token-manager-contract');
            const revenueTokenManager = new RevenueTokenManagerContract(wallet);

            let niiBalance = await niiContract.balanceOf(config.wallet.address);
            dbg(`Opening on-chain balance: ${ethers.utils.formatUnits(niiBalance, 15)} NII`);

            spinner.start(`1/8 - Registering claim for period ${period}`);
            const releaseTx = await revenueTokenManager.release(period - 1, options);
            spinner.succeed(`1/8 - Claim registered for period ${period}`);

            spinner.start('2/8 - Confirming claim');
            const releaseReceipt = await provider.getTransactionConfirmation(releaseTx.hash);
            spinner.succeed('2/8 - Claim confirmed');

            niiBalance = await niiContract.balanceOf(config.wallet.address);
            dbg(`Depositing: ${ethers.utils.formatUnits(niiBalance, 15)} NII`);

            spinner.start('Checking allowance');
            const allowance = await wallet.getDepositAllowance('NII');
            spinner.succeed('Allowance retrieved: ' + allowance.toString());

            let approveReceipt = null;

            if (allowance.lt(niiBalance)) {
                if (allowance.gt(ethers.utils.bigNumberify(0))) {
                    spinner.start('3/8 - Clearing allowance');
                    const pendingClearTx = await wallet.approveTokenDeposit(0, 'NII', options);
                    spinner.succeed('3/8 - Allowance cleared');

                    spinner.start('4/8 - Confirming allowance is cleared');
                    await provider.getTransactionConfirmation(pendingClearTx.hash);
                    spinner.succeed('4/8 - Allowance confirmed cleared');
                }
                else {
                    spinner.succeed('3/8 - Skipped');
                    spinner.succeed('4/8 - Skipped');
                }

                spinner.start(`5/8 - Approving transfer of ${niiBalance} NII`);
                const pendingApprovalTx = await wallet.approveTokenDeposit(ethers.utils.formatUnits(niiBalance, 15), 'NII', options);
                spinner.succeed('3/8 - Transfer approval registered');

                spinner.start('6/8 - Confirming transfer approval');
                approveReceipt = await provider.getTransactionConfirmation(pendingApprovalTx.hash);
                spinner.succeed('4/8 - Transfer approval confirmed');
            }
            else {
                spinner.succeed('3/8 - Skipped');
                spinner.succeed('4/8 - Skipped');
                spinner.succeed('5/8 - Skipped');
                spinner.succeed('6/8 - Skipped');
            }

            spinner.start('7/8 - Registering nahmii deposit');
            const pendingCompleteTx = await wallet.completeTokenDeposit(ethers.utils.formatUnits(niiBalance, 15), 'NII', options);
            spinner.succeed('7/8 - nahmii deposit registered');

            spinner.start('8/8 - Confirming nahmii deposit');
            const completeReceipt = await provider.getTransactionConfirmation(pendingCompleteTx.hash);
            spinner.succeed(`8/8 - nahmii deposit of ${niiBalance} NII confirmed`);

            console.error('Please allow a few minutes for the nahmii balance to be updated!');

            const output = [releaseReceipt, approveReceipt, completeReceipt].map(reduceReceipt);
            console.log(JSON.stringify(output));
        }
        catch (err) {
            dbg(err);
            spinner.fail();
            throw new Error(`Claiming NII failed: ${err.message}`);
        }
        finally {
            let niiBalance = ethers.utils.formatUnits(await niiContract.balanceOf(config.wallet.address), 15);
            dbg(`Closing on-chain balance: ${niiBalance} NII`);

            provider.stopUpdate();
        }
    }
};

function validateGasLimit(gas) {
    const gasLimit = parseInt(gas);
    if (gasLimit <= 0)
        throw new Error('Gas limit must be a number higher than 0');
    return gasLimit;
}

function validatePeriod(period) {
    period = parseInt(period);
    if (period < 1 || period > 120)
        throw new Error('Period must be a number from 1 to 120.');
    return period;
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
