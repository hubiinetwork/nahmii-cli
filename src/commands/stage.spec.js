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

const stubbedSettlementFactory = {
    getAllSettlements: sinon.stub(),
    calculateRequiredSettlements: sinon.stub()
};

stubbedSettlementFactory.reset = function() {
    this.getAllSettlements.reset();
    this.calculateRequiredSettlements.reset();
}.bind(stubbedSettlementFactory);

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
            SettlementFactory: function() {
                return stubbedSettlementFactory;
            },
            MonetaryAmount
        },
        '../config': stubbedConfig,
        'ora': function() {
            return stubbedOra;
        }
    });
}

describe('stage command', () => {
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
    const txRequest2 = {
        hash: 'tx hash 2'
    };
    const currency = '0x0000000000000000000000000000000000000000';
    let stageableSettlements;

    beforeEach(() => {
        stubbedConfig.privateKey
            .withArgs(stubbedConfig.wallet.secret)
            .resolves('privatekey');
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

    context('stage ETH', () => {
        beforeEach(() => {
            stageableSettlements = [
                {
                    type: 'payment', 
                    stageAmount: ethers.utils.parseUnits('1.0', 18),
                    currency,
                    isStageable: true,
                    stage: sinon.stub().resolves(txRequest1)
                },
                {
                    type: 'onchain-balance', 
                    stageAmount: ethers.utils.parseUnits('0.1', 18),
                    currency,
                    isStageable: true,
                    stage: sinon.stub().resolves(txRequest2)
                }
            ];
            stubbedSettlementFactory.getAllSettlements.resolves(stageableSettlements);
            return stageCmd.handler.call(undefined, {
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should settle qualified settlements', () => {
            for(const stageableSettlement of stageableSettlements) {
                expect(stageableSettlement.stage).to.have.been.calledWith(
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

    context('no qualified settlements to stage', () => {
        beforeEach(() => {
            const stageableSettlements = [
                {
                    type: 'payment', 
                    stageAmount: ethers.utils.parseUnits('1.0', 18),
                    currency,
                    isOngoing: true,
                    expirationTime: new Date(1)
                },
                {
                    type: 'onchain-balance', 
                    stageAmount: ethers.utils.parseUnits('0.1', 18),
                    currency,
                    isOngoing: true,
                    expirationTime: new Date(1)
                }
            ];
            stubbedSettlementFactory.getAllSettlements.resolves(stageableSettlements);
            return stageCmd.handler.call(undefined, {
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('should display message to show ongoing settlements', () => {
            expect(stubbedOra.info).to.be.calledWith('Ongoing settlement(s):');
            expect(stubbedOra.info).to.be.calledWith('Type: payment; Stage amount: 1.0; Expiration time: 1970-01-01T00:00:00.001Z');
            expect(stubbedOra.info).to.be.calledWith('Type: onchain-balance; Stage amount: 0.1; Expiration time: 1970-01-01T00:00:00.001Z');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('no qualified settlements to stage, and there are no ongoing settlements', () => {
        beforeEach(() => {
            stubbedSettlementFactory.getAllSettlements.resolves([]);
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

    context('fail to stage qualified settlements', () => {
        let error;
        beforeEach((done) => {
            stubbedSettlementFactory.getAllSettlements.throws(new Error('failed'));
            stageCmd.handler.call(undefined, {
                currency: 'ETH',
                gas: 2,
                price: 2
            }).catch(err => {
                error = err;
                done();
            });
        });

        describe('when #getAllSettlements failed', () => {
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
