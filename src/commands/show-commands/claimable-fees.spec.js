'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const {EthereumAddress} = require('nahmii-ethereum-address');

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const ethers = require('ethers');

function stubbedNahmiiProvider() {
    throw new Error('NahmiiProvider constructor not implemented!');
}

stubbedNahmiiProvider.from = sinon.stub();

const stubbedProviderInstance = {
    stopUpdate: sinon.stub(),
    getTokenInfo: sinon.stub(),
    getNetwork: sinon.stub()
};

const stubbedWallet = {
    address: sinon.stub()
};

const stubbedConfig = {
    wallet: {
        secret: 'secret much'
    },
    privateKey: sinon.stub(),
    apiRoot: 'some-api-root',
    appId: 'an-app-id',
    appSecret: 'much secret!',
    tokenHolderRevenueFundAbstractions: {
        'test-network': ['TokenHolderRevenueFund']
    }
};

const stubbedTokenInfo = {
    currency: ethers.constants.AddressZero,
    symbol: 'SYM',
    decimals: 15
};

const stubbedCurrency = {
    ct: EthereumAddress.from(ethers.constants.AddressZero),
    id: 0
};

const stubbedMonetaryAmount = {
    amount: 0,
    currency: stubbedCurrency
};

const stubbedOra = {
    start: sinon.stub(),
    succeed: sinon.stub(),
    fail: sinon.stub()
};

let stubbedFeesClaimant;

function proxyquireCommand() {
    return proxyquire('./claimable-fees', {
        'nahmii-sdk': {
            NahmiiProvider: stubbedNahmiiProvider,
            Wallet: function () {
                return stubbedWallet;
            },
            Currency: {
                from: sinon.stub().returns(stubbedCurrency)
            },
            MonetaryAmount: {
                from: sinon.stub().returns(stubbedMonetaryAmount)
            },
            FeesClaimant: function () {
                return stubbedFeesClaimant;
            }
        },
        '../../config': stubbedConfig,
        'ora': function () {
            return stubbedOra;
        }
    });
}

const currencyAsSymbol = 'SYM';

describe('Claim fees command', () => {
    let cmd, cmdOpts;

    beforeEach(() => {
        stubbedNahmiiProvider.from
            .withArgs(stubbedConfig.apiRoot, stubbedConfig.appId, stubbedConfig.appSecret)
            .resolves(stubbedProviderInstance);
        stubbedProviderInstance.getTokenInfo
            .withArgs(currencyAsSymbol)
            .resolves(stubbedTokenInfo);
        stubbedProviderInstance.getNetwork
            .returns({name: 'test-network'});
        stubbedConfig.privateKey
            .withArgs(stubbedConfig.wallet.secret)
            .resolves('privatekey');

        sinon.stub(console, 'log');

        stubbedFeesClaimant = {
            claimableFeesForBlocks: sinon.stub(),
            claimableFeesForAccruals: sinon.stub()
        };

        cmd = proxyquireCommand();
        cmdOpts = {
            currency: currencyAsSymbol
        };
    });

    afterEach(() => {
        console.log.restore();
    });

    describe('when called with single block', () => {
        beforeEach(() => {
            stubbedFeesClaimant.claimableFeesForBlocks
                .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                .resolves('1000.0');
        });

        it('should output claimable fees for the given block number', async () => {
            await cmd.handler(Object.assign(cmdOpts, {blocks: '1234'}));
            expect(console.log).to.have.been.calledWith(1000);
        });
    });

    describe('when called with range of block numbers', () => {
        beforeEach(() => {
            stubbedFeesClaimant.claimableFeesForBlocks
                .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                .resolves('1000.0');
        });

        it('should output claimable fees for the given range of block numbers', async () => {
            await cmd.handler(Object.assign(cmdOpts, {blocks: '1234-5678'}));
            expect(console.log).to.have.been.calledWith(1000);
        });
    });

    describe('when called with single accrual', () => {
        beforeEach(() => {
            stubbedFeesClaimant.claimableFeesForAccruals
                .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                .resolves('1000.0');
        });

        it('should output claimable fees for the given accrual', async () => {
            await cmd.handler(Object.assign(cmdOpts, {accruals: '1'}));
            expect(console.log).to.have.been.calledWith(1000);
        });
    });

    describe('when called with range of accruals', () => {
        beforeEach(() => {
            stubbedFeesClaimant.claimableFeesForAccruals
                .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                .resolves('1000.0');
        });

        it('should output claimable fees for the given range of accruals', async () => {
            await cmd.handler(Object.assign(cmdOpts, {accruals: '1-2'}));
            expect(console.log).to.have.been.calledWith(1000);
        });
    });
});
