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
    getRequiredChallengesForIntendedStageAmount: sinon.stub(),
    startByRequiredChallenge: sinon.stub(),
    getMaxChallengesTimeout: sinon.stub()
};

stubbedSettlement.reset = function() {
    this.getRequiredChallengesForIntendedStageAmount.reset();
    this.startByRequiredChallenge.reset();
    this.getMaxChallengesTimeout.reset();
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
    return proxyquire('./settle', {
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
    let settleCmd;
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
    const requiredSettlements = [
        {type: 'payment-driip', stageMonetaryAmount: MonetaryAmount.from(ethers.utils.parseUnits('1.0', 18), currency)},
        {type: 'null', stageMonetaryAmount: MonetaryAmount.from(ethers.utils.parseUnits('0.1', 18), currency)}
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
        settleCmd = proxyquireCommand();
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

    context('settle 1.1 ETH', () => {
        beforeEach(() => {
            stubbedSettlement.getRequiredChallengesForIntendedStageAmount.resolves({
                requiredChallenges: requiredSettlements,
                invalidReasons: []
            });
            stubbedSettlement.startByRequiredChallenge.resolves(txRequest1);
            return settleCmd.handler.call(undefined, {
                amount: '1.1',
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should started required settlements', () => {
            for(const requiredSettlement of requiredSettlements) {
                expect(stubbedSettlement.startByRequiredChallenge).to.have.been.calledWith(
                    requiredSettlement, 
                    stubbedWallet,
                    {
                        gasLimit: 2, 
                        gasPrice: ethers.utils.bigNumberify(2000000000)
                    }
                );
            }
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('no valid settlements to start with', () => {
        beforeEach(() => {
            stubbedSettlement.getRequiredChallengesForIntendedStageAmount.resolves({
                requiredChallenges: [],
                invalidReasons: []
            });
            return settleCmd.handler.call(undefined, {
                amount: '1.1',
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should display message to indicate not being able to start new settlements', () => {
            expect(stubbedOra.warn).to.be.calledWith('Can not start new settlement(s). Please check if the ongoing settlement(s) have expired.');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('settle more than available balance', () => {
        beforeEach(() => {
            return settleCmd.handler.call(undefined, {
                amount: '1.3',
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should display maximum settleable balance error', () => {
            expect(stubbedOra.fail).to.be.calledWith('The maximum settleable nahmii balance is 1.2');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('settle on non exist assets', () => {
        beforeEach(() => {
            return settleCmd.handler.call(undefined, {
                amount: '1.1',
                currency: 'ABC',
                gas: 2,
                price: 2
            });
        });

        it('should no available balance error', () => {
            expect(stubbedOra.fail).to.be.calledWith('No nahmii balance available for ABC');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    [
        stubbedProviderInstance.getTransactionConfirmation,
        stubbedSettlement.getRequiredChallengesForIntendedStageAmount,
        stubbedSettlement.startByRequiredChallenge
    ].forEach((func)=> {
        context('fail to start settlements', () => {
            let error;
            beforeEach((done) => {
                stubbedSettlement.getRequiredChallengesForIntendedStageAmount.resolves({
                    requiredChallenges: requiredSettlements,
                    invalidReasons: []
                });
                stubbedSettlement.startByRequiredChallenge.resolves(txRequest1);
                func.reset();
                func.rejects(new Error('failed'));
                settleCmd.handler.call(undefined, {
                    amount: '1.1',
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

    context('settle foo ETH', () => {
        it('yields an error', (done) => {
            settleCmd.handler
                .call(undefined, {
                    amount: 'foo',
                    currency: 'ETH',
                    gas: 2,
                    price: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*number/i);
                    done();
                });
        });
    });

    context('settle 0 ETH', () => {
        it('yields an error', (done) => {
            settleCmd.handler
                .call(undefined, {
                    amount: '0',
                    currency: 'ETH',
                    gas: 2,
                    price: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*zero/i);
                    done();
                });
        });
    });
});
