'use strict';

const dbg = require('../../dbg');
const nahmii = require('nahmii-sdk');
const ethers = require('ethers');
const ora = require('ora');

const blockSymbol = Symbol.for('block');
const accrualSymbol = Symbol.for('accrual');

module.exports = {
    command: 'fees for <currency> [--accruals=<startIndex>-<endIndex>] [--blocks=<startBlock>-<endBlock>] [--gas=<gaslimit>] [--price=<gasPrice in gwei>] [--timeout=<seconds>]',
    describe: 'Claims fees for <currency> either from inclusive range of accrual indices <startIndex> through <endIndex> or from inclusive range of block numbers <startBlock> through <endBlock>',
    builder: yargs => {
        yargs.example('claim fees for NII --blocks=8900000-8900100', 'Claims fees for NII tokens for blocks 8900000 through 8900100.');
        yargs.example('claim fees for ETH --accruals=3 --price=32', 'Claims fees for ETH for accrual index 3 paying 32 Gwei as gas price.');
        yargs.option('accruals', {
            desc: 'Single accrual index or range of accrual indices',
            alias: 'accrual',
            type: 'string'
        });
        yargs.option('blocks', {
            desc: 'Single block number or range of block numbers',
            alias: 'block',
            type: 'string'
        });
        yargs.option('gas', {
            desc: 'Gas limit used _per on-chain transaction_.',
            default: 6000000,
            type: 'number'
        });
        yargs.option('price', {
            desc: 'Gas price used _per transaction_. Deposits can be 1 or more transactions depending on the type of currency.',
            default: 12,
            type: 'number'
        });
        yargs.option('timeout', {
            desc: 'Number of seconds to wait for each on-chain transaction to be mined.',
            default: 60,
            type: 'number'
        });
        yargs.conflicts('accruals', 'blocks');
    },
    handler: async (argv) => {
        let range;
        if (argv.blocks) {
            const [startBlock, endBlock] = argv.blocks.split('-');
            range = {
                type: blockSymbol,
                start: validateBlock(startBlock, 'Start'),
                end: validateBlock(endBlock || startBlock, 'End')
            };
        }
        else if (argv.accruals) {
            const [startAccrualIndex, endAccrualIndex] = argv.accruals.split('-');
            range = {
                type: accrualSymbol,
                start: validateAccrual(startAccrualIndex, 'Start'),
                end: validateAccrual(endAccrualIndex || startAccrualIndex, 'End')
            };
        }

        const gasLimit = validateGasLimit(argv.gas);
        const timeout = validateTimeout(argv.timeout);
        const gasPriceGWEI = validateGasPrice(argv.price);

        const gasPrice = ethers.utils.parseUnits(gasPriceGWEI.toString(), 'gwei');
        const options = {gasLimit, gasPrice};

        const config = require('../../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);
        const privateKey = await config.privateKey(config.wallet.secret);
        const wallet = new nahmii.Wallet(privateKey, provider);
        const claimant = new nahmii.FeesClaimant(provider);

        const spinner = ora();
        try {
            if (blockSymbol === range.type) {
                range.claimableFeesFn = claimant.claimableFeesForBlocks;
                range.claimFeesFn = claimant.claimFeesForBlocks;
            }
            else if (accrualSymbol === range.type) {
                range.claimableFeesFn = claimant.claimableFeesForAccruals;
                range.claimFeesFn = claimant.claimFeesForAccruals;
            }

            const tokenInfo = await provider.getTokenInfo(argv.currency);
            const currency = nahmii.Currency.from({ct: tokenInfo.currency, id: 0});

            spinner.start('Obtaining claimable amount');
            const [claimableAmount, stagedAmount] = await Promise.all([
                range.claimableFeesFn.call(claimant, wallet, currency, range.start, range.end),
                claimant.withdrawableFees(wallet, currency)
            ]);
            spinner.succeed(`Claimable amount of ${tokenInfo.symbol} is ${ethers.utils.formatUnits(claimableAmount, tokenInfo.decimals)}`);

            if (stagedAmount.gt(0))
                spinner.succeed(`Previously claimed (and not withdrawn) amount of ${tokenInfo.symbol} is ${ethers.utils.formatUnits(stagedAmount, tokenInfo.decimals)}`);

            if (claimableAmount.gt(0)) {
                spinner.start(`Claiming ${ethers.utils.formatUnits(claimableAmount, tokenInfo.decimals)} ${tokenInfo.symbol}`);
                const claimAndStageTx = await range.claimFeesFn.call(claimant, wallet, currency, range.start, range.end, options);

                await provider.getTransactionConfirmation(claimAndStageTx.hash, timeout);
                spinner.succeed(`Claim of ${ethers.utils.formatUnits(claimableAmount, tokenInfo.decimals)} ${tokenInfo.symbol} confirmed`);
            }
            else {
                spinner.succeed('Nothing to claim');
            }

            spinner.start('Obtaining withdrawable amount');
            const withdrawableAmount = await claimant.withdrawableFees(wallet, currency);
            spinner.succeed(`Withdrawable amount of ${tokenInfo.symbol} is ${ethers.utils.formatUnits(withdrawableAmount, tokenInfo.decimals)}`);

            if (withdrawableAmount.gt(0)) {
                spinner.start(`Withdrawing ${ethers.utils.formatUnits(withdrawableAmount, tokenInfo.decimals)} ${tokenInfo.symbol}`);
                const withdrawableMonetaryAmount = await nahmii.MonetaryAmount.from(withdrawableAmount, tokenInfo.currency);
                const withdrawTx = await claimant.withdrawFees(wallet, withdrawableMonetaryAmount, options);

                await provider.getTransactionConfirmation(withdrawTx.hash, timeout);
                spinner.succeed(`Withdrawal of ${ethers.utils.formatUnits(withdrawableAmount, tokenInfo.decimals)} ${tokenInfo.symbol} confirmed`);
            }
            else {
                spinner.succeed('Nothing to withdraw');
            }
        }
        catch (err) {
            dbg(err);
            spinner.fail();
            throw new Error(`Claiming of fees failed: ${err.message}`);
        }
        finally {
            provider.stopUpdate();
        }
    }
};

function validateGasPrice(priceGWei) {
    const price = parseInt(priceGWei);
    if (price <= 0)
        throw new Error('Gas price must be a number higher than 0.');
    return price;
}

function validateGasLimit(gas) {
    const gasLimit = parseInt(gas);
    if (gasLimit <= 0)
        throw new Error('Gas limit must be a number higher than 0.');
    return gasLimit;
}

function validateBlock(index, name) {
    index = parseInt(index);
    if (Number.isNaN(index) || index < 0)
        throw new Error(`${name} block number must be a number higher than 0.`);
    return index;
}

function validateAccrual(index, name) {
    index = parseInt(index);
    if (Number.isNaN(index) || index < 0)
        throw new Error(`${name} accrual index must be a number higher than 0.`);
    return index;
}

function validateTimeout(timeout) {
    timeout = parseInt(timeout);
    if (timeout <= 0)
        throw new Error('Timeout must be a number higher than 0.');
    return timeout;
}
