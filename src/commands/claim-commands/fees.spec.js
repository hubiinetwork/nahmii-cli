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
    getBlockNumber: sinon.stub(),
    getApiAccessToken: sinon.stub(),
    stopUpdate: sinon.stub(),
    getTransactionConfirmation: sinon.stub(),
    getTokenInfo: sinon.stub()
};
stubbedProviderInstance.reset = function () {
    this.getBlockNumber.reset();
    this.getApiAccessToken.reset();
    this.stopUpdate.reset();
    this.getTransactionConfirmation.reset();
}.bind(stubbedProviderInstance);

const stubbedWallet = {
    address: sinon.stub()
};

const stubbedFeesClaimant = {
    claimableFeesForBlocks: sinon.stub(),
    claimFeesForBlocks: sinon.stub(),
    claimableFeesForAccruals: sinon.stub(),
    claimFeesForAccruals: sinon.stub(),
    withdrawableFees: sinon.stub(),
    withdrawFees: sinon.stub()
};
stubbedFeesClaimant.reset = function () {
    this.claimableFeesForBlocks.reset();
    this.claimFeesForBlocks.reset();
    this.claimableFeesForAccruals.reset();
    this.claimFeesForAccruals.reset();
    this.withdrawableFees.reset();
    this.withdrawFees.reset();
}.bind(stubbedFeesClaimant);

const stubbedConfig = {
    wallet: {
        secret: 'secret much'
    },
    privateKey: sinon.stub(),
    apiRoot: 'some-api-root',
    appId: 'an-app-id',
    appSecret: 'much secret!'
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

function proxyquireCommand() {
    return proxyquire('./fees', {
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
        stubbedConfig.privateKey
            .withArgs(stubbedConfig.wallet.secret)
            .resolves('privatekey');

        cmd = proxyquireCommand();
        cmdOpts = {
            currency: currencyAsSymbol,
            timeout: '60',
            gas: '6000000',
            price: '12'
        };
    });

    afterEach(() => {
        stubbedProviderInstance.getTransactionConfirmation.reset();
    });

    describe('when called with single block', () => {

        afterEach(() => {
            stubbedFeesClaimant.reset();
        });

        describe('when both claimable and previously claimed are non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(2000))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(3000));
                stubbedMonetaryAmount.amount = 3000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is zero and previously claimed is non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledOnce;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
                expect(stubbedOra.succeed).to.have.been.calledWith('Claim skipped');
            });
        });

        describe('when claimable is non-zero and previously claimed is zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when both claimable and previously claimed are zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(0));
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.not.have.been.called;
                expect(stubbedOra.succeed).to.have.been.calledWith('Claim skipped');
                expect(stubbedOra.succeed).to.have.been.calledWith('Withdrawal skipped');
            });
        });
    });

    describe('when called with block range', () => {

        afterEach(() => {
            stubbedFeesClaimant.reset();
        });

        describe('when both claimable and previously claimed are non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(2000))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(3000));
                stubbedMonetaryAmount.amount = 3000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given block range', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234-5678'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is zero and previously claimed is non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given block range', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234-5678'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledOnce;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is non-zero and previously claimed is zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given block range', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234-5678'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when both claimable and previously claimed are zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 5678)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(0));
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {blocks: '1234-5678'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.not.have.been.called;
                expect(stubbedOra.succeed).to.have.been.calledWith('Claim skipped');
                expect(stubbedOra.succeed).to.have.been.calledWith('Withdrawal skipped');
            });
        });
    });

    describe('when called with single accrual', () => {

        afterEach(() => {
            stubbedFeesClaimant.reset();
        });

        describe('when both claimable and previously claimed are non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(2000))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(3000));
                stubbedMonetaryAmount.amount = 3000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given accrual', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is zero and previously claimed is non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.claimFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given accrual', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledOnce;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is non-zero and previously claimed is zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given accrual', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when both claimable and previously claimed are zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 1)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(0));
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.not.have.been.called;
                expect(stubbedOra.succeed).to.have.been.calledWith('Claim skipped');
                expect(stubbedOra.succeed).to.have.been.calledWith('Withdrawal skipped');
            });
        });
    });

    describe('when called with accruals range', () => {

        afterEach(() => {
            stubbedFeesClaimant.reset();
        });

        describe('when both claimable and previously claimed are non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(2000))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(3000));
                stubbedMonetaryAmount.amount = 3000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given accruals range', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1-2'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is zero and previously claimed is non-zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.claimFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given accruals range', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1-2'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledOnce;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when claimable is non-zero and previously claimed is zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedMonetaryAmount.amount = 1000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should claim fees for the given accruals range', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1-2'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledTwice;
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('claim fees tx hash');
                expect(stubbedProviderInstance.getTransactionConfirmation).to.have.been.calledWith('withdraw fees tx hash');
            });
        });

        describe('when both claimable and previously claimed are zero', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForAccruals
                    .withArgs(stubbedWallet, stubbedCurrency, 1, 2)
                    .resolves(ethers.utils.bigNumberify(0));
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(0))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(0));
            });

            it('should claim fees for the given block number', async () => {
                await cmd.handler(Object.assign(cmdOpts, {accruals: '1-2'}));

                expect(stubbedProviderInstance.getTransactionConfirmation).to.not.have.been.called;
                expect(stubbedOra.succeed).to.have.been.calledWith('Claim skipped');
                expect(stubbedOra.succeed).to.have.been.calledWith('Withdrawal skipped');
            });
        });
    });

    describe('when called with negative block ', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {blocks: '-1234'})))
                .to.have.been.rejectedWith(/block number must be a number higher than 0./);
        });
    });

    describe('when called with negative accrual ', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '-1'})))
                .to.have.been.rejectedWith(/accrual index must be a number higher than 0./);
        });
    });

    describe('when called with negative gas limit', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '1-2', gas: '-1'})))
                .to.have.been.rejectedWith(/Gas limit must be a number higher than 0./);
        });
    });

    describe('when called with zero gas limit', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '1-2', gas: '0'})))
                .to.have.been.rejectedWith(/Gas limit must be a number higher than 0./);
        });
    });

    describe('when called with negative timeout', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '1-2', timeout: '-1'})))
                .to.have.been.rejectedWith(/Timeout must be a number higher than 0./);
        });
    });

    describe('when called with zero timeout', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '1-2', timeout: '0'})))
                .to.have.been.rejectedWith(/Timeout must be a number higher than 0./);
        });
    });

    describe('when called with negative gas price', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '1-2', price: '-1'})))
                .to.have.been.rejectedWith(/Gas price must be a number higher than 0./);
        });
    });

    describe('when called with zero gas price', () => {
        it('should revert', async () => {
            expect(cmd.handler(Object.assign(cmdOpts, {accruals: '1-2', price: '0'})))
                .to.have.been.rejectedWith(/Gas price must be a number higher than 0./);
        });
    });

    describe('mining fails', () => {
        afterEach(() => {
            stubbedFeesClaimant.reset();
        });

        describe('when claiming', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .rejects(new Error('Unable mine the claiming of fees'));
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(2000))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(3000));
                stubbedMonetaryAmount.amount = 3000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .resolves({hash: 'withdraw fees tx hash'});
            });

            it('should revert', async () => {
                expect(cmd.handler(Object.assign(cmdOpts, {blocks: '1234'})))
                    .to.have.been.rejectedWith(/Claiming of fees failed.*Unable mine the claiming of fees/);
            });
        });

        describe('when withdrawing', () => {
            beforeEach(() => {
                stubbedFeesClaimant.claimableFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves(ethers.utils.bigNumberify(1000));
                stubbedFeesClaimant.claimFeesForBlocks
                    .withArgs(stubbedWallet, stubbedCurrency, 1234, 1234)
                    .resolves({hash: 'claim fees tx hash'});
                stubbedFeesClaimant.withdrawableFees
                    .withArgs(stubbedWallet, stubbedCurrency)
                    .onFirstCall()
                    .resolves(ethers.utils.bigNumberify(2000))
                    .onSecondCall()
                    .resolves(ethers.utils.bigNumberify(3000));
                stubbedMonetaryAmount.amount = 3000;
                stubbedFeesClaimant.withdrawFees
                    .withArgs(stubbedWallet, stubbedMonetaryAmount)
                    .rejects(new Error('Unable mine the withdrawal of fees'));
            });

            it('should revert', async () => {
                expect(cmd.handler(Object.assign(cmdOpts, {blocks: '1234'})))
                    .to.have.been.rejectedWith(/Claiming of fees failed.*Unable mine the withdrawal of fees/);
            });
        });
    });
});
