'use strict';

const dbg = require('../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

const niiAddress = '0xde34dacbc68155187cc83f0bdc8d9ff528ad8c10';

module.exports = {
    command: 'claim nii for period <period> [--gas=<gaslimit>]',
    describe: 'Claims NII tokens from the time locked revenue token manager and deposits all NII to nahmii. Will only work if wallet is beneficiary of contract.',
    builder: yargs => {
        yargs.example('claim nii for period 1', 'Claims NII tokens for time locked period 1 (December 2018).');
        yargs.option('gas', {
            desc: 'Gas limit used _per on-chain transaction_.',
            default: 600000,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const period = validatePeriodIsPositiveInteger(argv.period);
        const gasLimit = validateGasLimitIsPositiveInteger(argv.gas);
        const options = {gasLimit};

        const config = require('../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const wallet = new nahmii.Wallet(config.privateKey(config.wallet.secret), provider);

        const Erc20Contract = require('nahmii-sdk/lib/wallet/erc20-contract');
        const niiContract = new Erc20Contract(niiAddress, wallet);

        let spinner = ora();
        try {
            const RevenueTokenManagerContract = require('../contracts/revenue-token-manager-contract');
            const revenueTokenManager = new RevenueTokenManagerContract(wallet);

            let niiBalance = ethers.utils.formatUnits(await niiContract.balanceOf(config.wallet.address), 15);
            dbg(`Opening on-chain balance: ${niiBalance} NII`);

            spinner.start(`1/6 - Registering claim for period ${period}`);
            const releaseTx = await revenueTokenManager.release(period - 1, options);
            spinner.succeed(`1/6 - Claim registered for period ${period}`);

            spinner.start('2/6 - Confirming claim');
            const releaseReceipt = await provider.getTransactionConfirmation(releaseTx.hash);
            spinner.succeed('2/6 - Claim confirmed');

            niiBalance = ethers.utils.formatUnits(await niiContract.balanceOf(config.wallet.address), 15);
            dbg(`Depositing: ${niiBalance} NII`);

            spinner.start(`3/6 - Approving transfer of ${niiBalance} NII`);
            const pendingApprovalTx = await wallet.approveTokenDeposit(niiBalance, 'NII', options);
            spinner.succeed('3/6 - Transfer approval registered');

            spinner.start('4/6 - Confirming transfer approval');
            const approveReceipt = await provider.getTransactionConfirmation(pendingApprovalTx.hash);
            spinner.succeed('4/6 - Transfer approval confirmed');

            spinner.start('5/6 - Registering nahmii deposit');
            const pendingCompleteTx = await wallet.completeTokenDeposit(niiBalance, 'NII', options);
            spinner.succeed('5/6 - nahmii deposit registered');

            spinner.start('6/6 - Confirming nahmii deposit');
            const completeReceipt = await provider.getTransactionConfirmation(pendingCompleteTx.hash);
            spinner.succeed(`6/6 - nahmii deposit of ${niiBalance} NII confirmed`);

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

let validateGasLimitIsPositiveInteger = function(gas) {
    const gasLimit = parseInt(gas);
    if (gasLimit <= 0)
        throw new Error('Gas limit must be a number higher than 0');
    return gasLimit;
};

let validatePeriodIsPositiveInteger = function(period) {
    period = parseInt(period);
    if (period < 1 || period > 120)
        throw new Error('Period must be a number from 1 to 120.');
    return period;
};

function reduceReceipt(txReceipt) {
    // TODO: Fix links when on mainnet
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}
