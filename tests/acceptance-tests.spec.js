'use strict';

const tu = require('./test-utils');

const chai = require('chai');

const shell = require('shelljs');
shell.config.silent = true;

const expect = chai.expect;
const when = describe;

function nahmii_cli (argStr) {
    return shell.exec('nahmii ' + argStr).toString();
}

describe ('nahmii-cli', () => {
    let alice, bob;

    beforeEach (async () => {
        alice = await tu.getConfigWallet();
        bob = await tu.getRandomWallet();
    });

    when ('showing version', () => {
        const latestVer = shell.exec(
            'npm view nahmii-cli | sed "s,\\x1B\\[[0-9;]*m,,g" | grep "latest:" | sed "s/[^:]*: \\(.*\\)/\\1/"'
        ).toString();

        it ('is of latest version', () => {
            expect(nahmii_cli('--version')).to.equal(latestVer);
        });
    });

    when ('showing balance', () => {
        let cliBalances, sdkBalances;

        before(async () => {
            cliBalances = JSON.parse(nahmii_cli('show balance') || '{}');
            sdkBalances = await alice.getNahmiiBalance();
        });

        for (const symbol of ['ETH', 'HBT', 'NII']) {
            it (`shows ${symbol} balance`, () => {
                expect(cliBalances[symbol]).to.equal(sdkBalances[symbol]);
            });
        }
    });

    when ('depositing ETH', () => {
        let amount, balanceDiff;

        before(async () => {
            alice.balanceIn = (await alice.getNahmiiBalance()).ETH;

            amount = '0.01';
            nahmii_cli(`deposit ${amount} ETH`);
            await tu.delay12Blocks();

            alice.balanceOut = (await alice.getNahmiiBalance()).ETH;
            balanceDiff = tu.sub(alice.balanceOut, alice.balanceIn);

            console.log('');
            console.log(`amount: ${amount}, balanceIn: ${alice.balanceIn}, balanceOut: ${alice.balanceOut}, balanceDiff: ${balanceDiff}`);
        });

        it ('ETH balance increases with deposited amount', () => {
            expect(tu.eq(balanceDiff, amount)).to.be.true;
        });
    });

    when ('paying a ETH', () => {
        let amount, balanceDiff;

        before(async () => {
            alice.balanceIn = (await alice.getNahmiiBalance()).ETH;
            bob.balanceIn = (await bob.getNahmiiBalance()).ETH || '0.0';

            amount = '0.01';
            nahmii_cli(`pay ${amount} ETH to ${bob.address}`);

            alice.balanceOut = (await alice.getNahmiiBalance()).ETH;
            bob.balanceOut = (await bob.getNahmiiBalance()).ETH;

            balanceDiff = tu.sub(bob.balanceOut, bob.balanceIn);

            console.log('');
            console.log(`balanceIn: ${bob.balanceIn}, balanceOut: ${bob.balanceOut}, amount: ${amount}, balanceDiff: ${balanceDiff}`);
        });

        it ('increases bob\'s balance with paid amount', () => {
            expect(tu.eq(balanceDiff, amount)).to.be.true;
        });
    });
});