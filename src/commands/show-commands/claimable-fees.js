'use strict';

const dbg = require('../../dbg');
const nahmii = require('nahmii-sdk');

const blockSymbol = Symbol.for('block');
const accrualSymbol = Symbol.for('accrual');

module.exports = {
    command: 'claimable fees for <currency> [--accruals=<firstIndex>-<lastIndex>]',
    describe: 'Show my claimable fees for <currency>',
    builder: yargs => {
        yargs.example('claimable fees for NII --accruals=0-2', 'Show claimable fees for NII tokens for accrual indices 0 through 2.');
        yargs.example('claimable fees for ETH --accrual=3', 'Show claimable fees for ETH for accrual index 3.');
        yargs.option('accruals', {
            desc: 'Single accrual index or range of accrual indices',
            alias: 'accrual',
            type: 'string'
        });
        yargs.option('blocks', {
            desc: 'Single block number or range of block numbers',
            alias: 'block',
            type: 'string',
            hidden: true
        });
        yargs.conflicts('accruals', 'blocks');
    },
    handler: async (argv) => {
        let range;
        if (argv.blocks) {
            const [firstBlock, lastBlock] = argv.blocks.split('-');
            range = {
                type: blockSymbol,
                first: validateBlock(firstBlock, 'First'),
                last: validateBlock(lastBlock || firstBlock, 'Last')
            };
        }
        else if (argv.accruals) {
            const [firstAccrual, lastAccrual] = argv.accruals.split('-');
            range = {
                type: accrualSymbol,
                first: validateAccrual(firstAccrual, 'First'),
                last: validateAccrual(lastAccrual || firstAccrual, 'Last')
            };
        }

        const config = require('../../config');
        const provider = await nahmii.NahmiiProvider.from(config.apiRoot, config.appId, config.appSecret);

        const network = await provider.getNetwork();

        try {
            const tokenInfo = await provider.getTokenInfo(argv.currency);
            const currency = nahmii.Currency.from({ct: tokenInfo.currency, id: 0});

            const privateKey = await config.privateKey(config.wallet.secret);
            const wallet = new nahmii.Wallet(privateKey, provider);

            const claimant = new nahmii.FeesClaimant(provider, config.tokenHolderRevenueFundAbstractions[network.name]);

            let claimableFeesFn;
            if (blockSymbol === range.type)
                claimableFeesFn = claimant.claimableFeesForBlocks;
            else if (accrualSymbol === range.type)
                claimableFeesFn = claimant.claimableFeesForAccruals;

            const claimableAmount = await claimableFeesFn.call(claimant, wallet, currency, range.first, range.last);
            console.log(parseFloat(claimableAmount));
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to retrieve the claimable fees.');
        }
        finally {
            provider.stopUpdate();
        }
    }
};

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