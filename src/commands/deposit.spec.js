'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const ethers = require('ethers');

const stubbedWallet = {
    depositEth: sinon.stub(),
    approveTokenDeposit: sinon.stub(),
    completeTokenDeposit: sinon.stub()
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
    getTransactionConfirmation: sinon.stub()
};
stubbedProviderInstance.reset = function() {
    this.getBlockNumber.reset();
    this.getApiAccessToken.reset();
    this.stopUpdate.reset();
    this.getTransactionConfirmation.reset();
}.bind(stubbedProviderInstance);

const stubbedOra = {
    start: sinon.stub(),
    succeed: sinon.stub(),
    fail: sinon.stub()
};
stubbedOra.start.returns(stubbedOra);

function proxyquireCommand() {
    return proxyquire('./deposit', {
        'nahmii-sdk': {
            NahmiiProvider: fakeNahmiiProvider,
            Wallet: function() {
                return stubbedWallet;
            }
        },
        '../config': stubbedConfig,
        'ora': function() {
            return stubbedOra;
        }
    });
}

describe('Deposit command', () => {
    let depositCmd;
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
        sinon.stub(console, 'log');
        depositCmd = proxyquireCommand();
        stubbedWallet.depositEth.resolves({hash: txReceipt1.transactionHash});
        stubbedWallet.approveTokenDeposit.resolves({hash: txReceipt1.transactionHash});
        stubbedWallet.completeTokenDeposit.resolves({hash: txReceipt2.transactionHash});
    });

    afterEach(() => {
        stubbedWallet.depositEth.reset();
        stubbedWallet.approveTokenDeposit.reset();
        stubbedWallet.completeTokenDeposit.reset();
        stubbedConfig.privateKey.reset();
        fakeNahmiiProvider.from.reset();
        stubbedProviderInstance.reset();
        console.log.restore();
    });

    context('deposit 1.1 ETH', () => {
        beforeEach(() => {
            return depositCmd.handler.call(undefined, {
                amount: '1.1',
                currency: 'ETH',
                gas: 2,
                price: 2
            });
        });

        it('tells wallet to deposit 1.1 ETH', () => {
            expect(stubbedWallet.depositEth).to.have.been.calledWith('1.1', {gasLimit: 2, gasPrice: ethers.utils.bigNumberify(2000000000)});
        });

        it('outputs an single receipt to stdout', () => {
            expect(console.log).to.have.been.calledWith(JSON.stringify([
                {
                    transactionHash: txReceipt1.transactionHash,
                    blockNumber: txReceipt1.blockNumber,
                    gasUsed: '123',
                    href: `https://ropsten.etherscan.io/tx/${txReceipt1.transactionHash}`
                }
            ]));
        });

        it('stops token refresh', () => {
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('deposit 0.07 TT1', () => {
        beforeEach(() => {
            return depositCmd.handler.call(undefined, {
                amount: '0.07',
                currency: 'TT1',
                gas: 2,
                price: 1
            });
        });

        it('tells wallet to approve 0.07 TT1 transfer', () => {
            expect(stubbedWallet.approveTokenDeposit).to.have.been.calledWith('0.07', 'TT1', {gasLimit: 2, gasPrice: ethers.utils.bigNumberify(1000000000)});
        });

        it('tells wallet to complete 0.07 TT1 transfer', () => {
            expect(stubbedWallet.completeTokenDeposit).to.have.been.calledWith('0.07', 'TT1', {gasLimit: 2, gasPrice: ethers.utils.bigNumberify(1000000000)});
        });

        it('outputs correct tx receipts to stdout', () => {
            expect(console.log).to.have.been.calledWith(JSON.stringify([
                {
                    transactionHash: txReceipt1.transactionHash,
                    blockNumber: txReceipt1.blockNumber,
                    gasUsed: '123',
                    href: `https://ropsten.etherscan.io/tx/${txReceipt1.transactionHash}`
                },
                {
                    transactionHash: txReceipt2.transactionHash,
                    blockNumber: txReceipt2.blockNumber,
                    gasUsed: '1234',
                    href: `https://ropsten.etherscan.io/tx/${txReceipt2.transactionHash}`
                }
            ]));
        });

        it('stops token refresh', () => {
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('deposit foo ETH', () => {
        it('yields an error', (done) => {
            depositCmd.handler
                .call(undefined, {
                    amount: 'foo',
                    currency: 'ETH',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*number/i);
                    done();
                });
        });

        it('provider was not instantiated', (done) => {
            depositCmd.handler
                .call(undefined, {
                    amount: 'foo',
                    currency: 'ETH',
                    gas: 2
                })
                .catch(() => {
                    expect(fakeNahmiiProvider.from).to.not.have.been.called;
                    done();
                });
        });
    });

    context('deposit 0 ETH', () => {
        it('yields an error', (done) => {
            depositCmd.handler
                .call(undefined, {
                    amount: '0',
                    currency: 'ETH',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*zero/i);
                    done();
                });
        });

        it('provider was not instantiated', (done) => {
            depositCmd.handler
                .call(undefined, {
                    amount: '0',
                    currency: 'ETH',
                    gas: 2
                })
                .catch(() => {
                    expect(fakeNahmiiProvider.from).to.not.have.been.called;
                    done();
                });
        });

    });

    [
        stubbedProviderInstance.getTransactionConfirmation,
        stubbedWallet.depositEth
    ].forEach((depositFunc)=> {
        context('wallet fails to deposit ETH', () => {
            let error;

            beforeEach((done) => {
                depositFunc.reset();
                depositFunc.rejects(new Error('transaction failed'));
                depositCmd.handler
                    .call(undefined, {
                        amount: '1.2',
                        currency: 'ETH',
                        gas: 2,
                        price: 1
                    })
                    .catch(err => {
                        error = err;
                        done();
                    });
            });

            it('yields an error', () => {
                expect(error.message).to.match(/transaction failed/);
            });

            it('stops token refresh', () => {
                expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
            });
        });
    });

    [
        stubbedProviderInstance.getTransactionConfirmation,
        stubbedWallet.approveTokenDeposit,
        stubbedWallet.completeTokenDeposit
    ].forEach((tokenDepositFunc)=> {
        context('wallet fails to deposit a token', () => {
            let error;

            beforeEach((done) => {
                tokenDepositFunc.reset();
                tokenDepositFunc.rejects(new Error('transaction failed'));
                depositCmd.handler
                    .call(undefined, {
                        amount: '1.2',
                        currency: 'TT1',
                        gas: 2,
                        price: 1
                    })
                    .catch(err => {
                        error = err;
                        done();
                    });
            });

            it('yields an error', () => {
                expect(error.message).to.match(/transaction failed/);
            });

            it('stops token refresh', () => {
                expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
            });
        });
    });
});
