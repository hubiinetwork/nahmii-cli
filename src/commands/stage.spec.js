'use strict';

const {MonetaryAmount} = require('nahmii-sdk');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const ethers = require('ethers');

const stubbedWallet = {
    getNahmiiBalance: sinon.stub()
};


const stubbedConfig = {
    wallet: {
        secret: 'secret much'
    },
    privateKey: sinon.stub(),
    apiRoot: 'some-api-root',
    appId: 'an-app-id',
    appSecret: 'much secret!'
};

function fakeNahmiiProvider() {
    throw new Error('NahmiiProvider constructor not implemented!');
}
fakeNahmiiProvider.from = sinon.stub();

const stubbedProviderInstance = {
    getBlockNumber: sinon.stub(),
    getApiAccessToken: sinon.stub(),
    stopUpdate: sinon.stub(),
    getTransactionConfirmation: sinon.stub(),
    getTokenInfo: sinon.stub()
};
stubbedProviderInstance.reset = function() {
    this.getBlockNumber.reset();
    this.getApiAccessToken.reset();
    this.stopUpdate.reset();
    this.getTransactionConfirmation.reset();
    this.getTokenInfo.reset();
}.bind(stubbedProviderInstance);

const stubbedSettlement = {
    getSettleableChallenges: sinon.stub(),
    getOngoingChallenges: sinon.stub(),
    settleBySettleableChallenge: sinon.stub()
};

stubbedSettlement.reset = function() {
    this.getSettleableChallenges.reset();
    this.getOngoingChallenges.reset();
    this.settleBySettleableChallenge.reset();
}.bind(stubbedSettlement);

const stubbedOra = {
    start: sinon.stub(),
    succeed: sinon.stub(),
    info: sinon.stub(),
    warn: sinon.stub(),
    fail: sinon.stub(),
    stop: sinon.stub()
};
stubbedOra.reset = function() {
    this.start.reset();
    this.succeed.reset();
    this.info.reset();
    this.warn.reset();
    this.fail.reset();
    this.stop.reset();
}.bind(stubbedOra);
stubbedOra.start.returns(stubbedOra);

function proxyquireCommand() {
    return proxyquire('./stage', {
        'nahmii-sdk': {
            NahmiiProvider: fakeNahmiiProvider,
            Wallet: function() {
                return stubbedWallet;
            },
            Settlement: function() {
                return stubbedSettlement;
            },
            MonetaryAmount
        },
        '../config': stubbedConfig,
        'ora': function() {
            return stubbedOra;
        }
    });
}

describe('Settle command', () => {
    let stageCmd;
    const txReceipt1 = {
        transactionHash: 'tx hash 1',
        blockNumber: 2,
        gasUsed: ethers.utils.bigNumberify(123)
    };
    const txReceipt2 = {
        transactionHash: 'tx hash 2',
        blockNumber: 3,
        gasUsed: ethers.utils.bigNumberify(1234)
    };
    const txRequest1 = {
        hash: 'tx hash 1'
    };
    const currency = '0x0000000000000000000000000000000000000000';
    const settleableChallenges = [
        {type: 'payment-driip', intendedStageAmount: MonetaryAmount.from(ethers.utils.parseUnits('1.0', 18), currency)},
        {type: 'null', intendedStageAmount: MonetaryAmount.from(ethers.utils.parseUnits('0.1', 18), currency)}
    ];
    const ongoingChallenges = [
        {
            type: 'payment-driip',
            expirationTime: new Date(1),
            intendedStageAmount: MonetaryAmount.from(ethers.utils.parseUnits('1.0', 18), currency)
        },
        {
            type: 'null',
            expirationTime: new Date(1),
            intendedStageAmount: MonetaryAmount.from(ethers.utils.parseUnits('0.1', 18), currency)
        }
    ];

    beforeEach(() => {
        stubbedConfig.privateKey
            .withArgs(stubbedConfig.wallet.secret)
            .returns('privatekey');
        fakeNahmiiProvider.from
            .withArgs(stubbedConfig.apiRoot, stubbedConfig.appId, stubbedConfig.appSecret)
            .resolves(stubbedProviderInstance);
        stubbedProviderInstance.getTransactionConfirmation
            .withArgs(txReceipt1.transactionHash)
            .returns(txReceipt1);
        stubbedProviderInstance.getTransactionConfirmation
            .withArgs(txReceipt2.transactionHash)
            .returns(txReceipt2);
        stubbedProviderInstance.getBlockNumber.resolves(1);
        stubbedProviderInstance.getApiAccessToken.resolves('nahmii JWT');
        stubbedProviderInstance.getTokenInfo.resolves({
            currency: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            decimals: 18
        });
        sinon.stub(console, 'log');
        stageCmd = proxyquireCommand();
        stubbedWallet.getNahmiiBalance.resolves({ETH: '1.2'});
    });

    afterEach(() => {
        stubbedWallet.getNahmiiBalance.reset();
        stubbedConfig.privateKey.reset();
        fakeNahmiiProvider.from.reset();
        stubbedProviderInstance.reset();
        stubbedOra.reset();
        console.log.restore();
    });

    context.only('stage ETH', () => {
        beforeEach(() => {
            stubbedSettlement.getSettleableChallenges.resolves({
                settleableChallenges,
                invalidReasons: []
            });
            stubbedSettlement.getOngoingChallenges.resolves(ongoingChallenges);
            stubbedSettlement.settleBySettleableChallenge.resolves(txRequest1);
            return stageCmd.handler.call(undefined, {
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should settle qualified settlements', () => {
            for(const settleableChallenge of settleableChallenges) {
                expect(stubbedSettlement.settleBySettleableChallenge).to.have.been.calledWith(
                    settleableChallenge, 
                    stubbedWallet,
                    {
                        gasLimit: 2, 
                        gasPrice: ethers.utils.bigNumberify(2000000000)
                    }
                );
            }
            expect(stubbedOra.info).to.have.been.calledWith('There are 2 settlement(s) ready to be staged with total stage amount 1.1');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context.only('no qualified settlements to settle', () => {
        beforeEach(() => {
            stubbedSettlement.getSettleableChallenges.resolves({
                settleableChallenges: [],
                invalidReasons: []
            });
            stubbedSettlement.getOngoingChallenges.resolves(ongoingChallenges);
            return stageCmd.handler.call(undefined, {
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should display message to show ongoing settlements', () => {
            expect(stubbedOra.info).to.be.calledWith('Type: payment-driip; Stage amount: 1.0; Expiration time: 1970-01-01T00:00:00.001Z');
            expect(stubbedOra.info).to.be.calledWith('Type: null; Stage amount: 0.1; Expiration time: 1970-01-01T00:00:00.001Z');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context.only('no qualified settlements to settle, and there are no ongoing settlements', () => {
        beforeEach(() => {
            stubbedSettlement.getSettleableChallenges.resolves({
                settleableChallenges: [],
                invalidReasons: []
            });
            stubbedSettlement.getOngoingChallenges.resolves([]);
            return stageCmd.handler.call(undefined, {
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should display message to indicate no ongoing settlements exist', () => {
            expect(stubbedOra.info).to.be.calledWith('There are no ongoing settlement(s).');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    [
        stubbedProviderInstance.getTransactionConfirmation,
        stubbedSettlement.getSettleableChallenges,
        stubbedSettlement.settleBySettleableChallenge
    ].forEach((func)=> {
        context.only('fail to settle qualified settlements', () => {
            let error;
            beforeEach((done) => {
                stubbedSettlement.getSettleableChallenges.resolves({
                    settleableChallenges,
                    invalidReasons: []
                });
                stubbedSettlement.getOngoingChallenges.resolves(ongoingChallenges);
                stubbedSettlement.settleBySettleableChallenge.resolves(txRequest1);
                func.reset();
                func.rejects(new Error('failed'));
                stageCmd.handler.call(undefined, {
                    currency: 'ETH',
                    gas: 2,
                    price: 2
                }).catch(err => {
                    error = err;
                    done();
                });
            });

            it('yields an error', () => {
                expect(error.message).to.match(/failed/);
            });

            it('stops token refresh/spinner', () => {
                expect(stubbedOra.stop).to.have.been.called;
                expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
            });
        });
    });
});
