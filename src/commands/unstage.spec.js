'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const ethers = require('ethers');
const {MonetaryAmount} = require('nahmii-sdk');

const stubbedWallet = {
    unstage: sinon.stub(),
    getNahmiiStagedBalance: sinon.stub()
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

const stubbedOra = {
    start: sinon.stub(),
    stop: sinon.stub(),
    succeed: sinon.stub(),
    fail: sinon.stub()
};
stubbedOra.start.returns(stubbedOra);

function proxyquireCommand() {
    return proxyquire('./unstage', {
        'nahmii-sdk': {
            NahmiiProvider: fakeNahmiiProvider,
            Wallet: function() {
                return stubbedWallet;
            },
            MonetaryAmount
        },
        '../config': stubbedConfig,
        'ora': function() {
            return stubbedOra;
        }
    });
}

describe('Unstage command', () => {
    let unstageCmd;
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
    const tokenInfo = {
        symbol: 'ETH',
        ct: '0x0000000000000000000000000000000000000000',
        decimals: 18
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
        stubbedProviderInstance.getTokenInfo.resolves({
            currency: tokenInfo.ct,
            symbol: tokenInfo.symbol,
            decimals: tokenInfo.decimals
        });
        sinon.stub(console, 'log');
        unstageCmd = proxyquireCommand();
        stubbedWallet.unstage.resolves({hash: txReceipt1.transactionHash});
        stubbedWallet.getNahmiiStagedBalance.resolves(ethers.utils.parseUnits('1.2', 18));
    });

    afterEach(() => {
        stubbedWallet.unstage.reset();
        stubbedConfig.privateKey.reset();
        fakeNahmiiProvider.from.reset();
        stubbedProviderInstance.reset();
        console.log.restore();
    });

    context('unstage 1.1 ETH', () => {
        const amount = '1.1';
        const amountBN = ethers.utils.parseUnits(amount, tokenInfo.decimals);
        const monetaryAmount = MonetaryAmount.from(amountBN, tokenInfo.ct);

        beforeEach(() => {
            return unstageCmd.handler.call(undefined, {
                amount,
                currency: tokenInfo.symbol,
                gas: 2,
                price: 2
            });
        });
        
        it('tells wallet to unstage 1.1 ETH', () => {
            expect(stubbedWallet.unstage).to.have.been.calledWith(monetaryAmount, {gasLimit: 2, gasPrice: ethers.utils.bigNumberify(2000000000)});
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

    context('unstage more than staged balance', () => {
        beforeEach(() => {
            return unstageCmd.handler.call(undefined, {
                amount: '1.3',
                currency: tokenInfo.symbol,
                gas: 2,
                price: 2
            });
        });

        it('should display maximum unstage amount error', () => {
            expect(stubbedOra.fail).to.be.calledWith('The maximum unstage amount is 1.2');
        });

        it('stops token refresh/spinner', () => {
            expect(stubbedOra.stop).to.have.been.called;
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context('unstage foo ETH', () => {
        it('yields an error', (done) => {
            unstageCmd.handler
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

    });

    context('unstage 0 ETH', () => {
        it('yields an error', (done) => {
            unstageCmd.handler
                .call(undefined, {
                    amount: '0',
                    currency: 'ETH',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*strictly greater than zero/i);
                    done();
                });
        });

    });

    context('unstage -1 ETH', () => {
        it('yields an error', (done) => {
            unstageCmd.handler
                .call(undefined, {
                    amount: '-1',
                    currency: 'ETH',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*strictly greater than zero/i);
                    done();
                });
        });

    });

    [
        stubbedProviderInstance.getTransactionConfirmation,
        stubbedWallet.unstage
    ].forEach((unstageFunc)=> {
        context('wallet fails to unstage ETH', () => {
            let error;

            beforeEach((done) => {
                unstageFunc.reset();
                unstageFunc.rejects(new Error('transaction failed'));
                unstageCmd.handler
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
});
