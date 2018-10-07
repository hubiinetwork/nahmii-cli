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
    depositToken: sinon.stub()
};

const stubbedConfig = {
    wallet: {
        secret: 'secret much'
    },
    privateKey: sinon.stub()
};

const stubbedProviderConstructor = sinon.stub();

const stubbedProvider = {
    getBlockNumber: sinon.stub(),
    getApiAccessToken: sinon.stub(),
    stopUpdate: sinon.stub()
};

function proxyquireCommand() {
    return proxyquire('./deposit', {
        'nahmii-sdk': {
            NahmiiProvider: stubbedProviderConstructor,
            Wallet: function() {
                return stubbedWallet;
            }
        },
        '../config': stubbedConfig
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
            .returns('privatekey');
        stubbedProviderConstructor
            .withArgs(stubbedConfig.apiRoot, stubbedConfig.appId, stubbedConfig.appSecret)
            .returns(stubbedProvider);
        stubbedProvider.getBlockNumber.resolves(1);
        stubbedProvider.getApiAccessToken.resolves('nahmii JWT');
        sinon.stub(console, 'log');
        depositCmd = proxyquireCommand();
        stubbedWallet.depositEth.resolves(txReceipt1);
        stubbedWallet.depositToken.resolves([txReceipt1, txReceipt2]);
    });

    afterEach(() => {
        stubbedWallet.depositEth.reset();
        stubbedWallet.depositToken.reset();
        stubbedConfig.privateKey.reset();
        stubbedProviderConstructor.reset();
        stubbedProvider.getBlockNumber.reset();
        stubbedProvider.getApiAccessToken.reset();
        stubbedProvider.stopUpdate.reset();
        console.log.restore();
    });

    context('deposit 1.1 ETH', () => {
        beforeEach(() => {
            return depositCmd.handler.call(undefined, {
                amount: '1.1',
                currency: 'ETH',
                gas: 2
            });
        });

        it('tells wallet to deposit 1.1 ETH', () => {
            expect(stubbedWallet.depositEth).to.have.been.calledWith('1.1', {gasLimit: 2});
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
            expect(stubbedProvider.stopUpdate).to.have.been.called;
        });
    });

    context('deposit 0.07 TT1', () => {
        beforeEach(() => {
            return depositCmd.handler.call(undefined, {
                amount: '0.07',
                currency: 'TT1',
                gas: 2
            });
        });

        it('tells wallet to deposit 0.07 TT1', () => {
            expect(stubbedWallet.depositToken).to.have.been.calledWith('0.07', 'TT1', {gasLimit: 2});
        });

        it('outputs 2 receipts to stdout', () => {
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
            expect(stubbedProvider.stopUpdate).to.have.been.called;
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
                    expect(stubbedProviderConstructor).to.not.have.been.called;
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
                    expect(stubbedProviderConstructor).to.not.have.been.called;
                    done();
                });
        });

    });

    context('wallet fails to deposit ETH', () => {
        let error;

        beforeEach((done) => {
            stubbedWallet.depositEth.reset();
            stubbedWallet.depositEth.rejects(new Error('transaction failed'));
            depositCmd.handler
                .call(undefined, {
                    amount: '1.2',
                    currency: 'ETH',
                    gas: 2
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
            expect(stubbedProvider.stopUpdate).to.have.been.called;
        });
    });

    context('wallet fails to deposit token', () => {
        let error;

        beforeEach((done) => {
            stubbedWallet.depositToken.reset();
            stubbedWallet.depositToken.rejects(new Error('transaction failed'));
            depositCmd.handler
                .call(undefined, {
                    amount: '1.2',
                    currency: 'TT1',
                    gas: 2
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
            expect(stubbedProvider.stopUpdate).to.have.been.called;
        });
    });
});
