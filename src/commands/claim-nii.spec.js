'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const ethers = require('ethers');

const stubbedWallet = {
    approveTokenDeposit: sinon.stub(),
    completeTokenDeposit: sinon.stub(),
    getDepositAllowance: sinon.stub()
};
stubbedWallet.reset = function() {
    this.approveTokenDeposit.reset();
    this.completeTokenDeposit.reset();
    this.getDepositAllowance.reset();
}.bind(stubbedWallet);

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

const stubbedRevenueTokenManager = {
    release: sinon.stub()
};
stubbedRevenueTokenManager.reset = function() {
    this.release.reset();
}.bind(stubbedRevenueTokenManager);

const erc20contractClass = {
    from: sinon.stub()
};

const stubbedNiiContract = {
    balanceOf: sinon.stub()
};
stubbedNiiContract.reset = function() {
    this.balanceOf.reset();
}.bind(stubbedNiiContract);

function proxyquireCommand() {
    return proxyquire('./claim-nii', {
        'nahmii-sdk': {
            NahmiiProvider: fakeNahmiiProvider,
            Wallet: function() {
                return stubbedWallet;
            },
            Erc20Contract: erc20contractClass
        },
        '../config': stubbedConfig,
        'ora': function() {
            return stubbedOra;
        },
        '../contracts/revenue-token-manager-contract': function() {
            return stubbedRevenueTokenManager;
        }
    });
}

const txs = [{hash: 'tx hash 1'}, {hash: 'tx hash 2'}, {hash: 'tx hash 3'}, {hash: 'tx hash 4'}];

const txReceipts = [
    {
        transactionHash: 'tx hash 1',
        blockNumber: 2,
        gasUsed: ethers.utils.bigNumberify(123)
    }, {
        transactionHash: 'tx hash 2',
        blockNumber: 3,
        gasUsed: ethers.utils.bigNumberify(1234)
    }, {
        transactionHash: 'tx hash 3',
        blockNumber: 4,
        gasUsed: ethers.utils.bigNumberify(12345)
    }, {
        transactionHash: 'tx hash 4',
        blockNumber: 5,
        gasUsed: ethers.utils.bigNumberify(23456)
    }];

describe('Claim NII command', () => {
    let cmd;

    beforeEach(() => {
        stubbedConfig.privateKey
            .withArgs(stubbedConfig.wallet.secret)
            .returns('privatekey');
        fakeNahmiiProvider.from
            .withArgs(stubbedConfig.apiRoot, stubbedConfig.appId, stubbedConfig.appSecret)
            .resolves(stubbedProviderInstance);
        stubbedRevenueTokenManager.release.resolves(txs[0]);
        stubbedWallet.getDepositAllowance.resolves(ethers.utils.bigNumberify(0));
        stubbedWallet.approveTokenDeposit.withArgs(0, 'NII').resolves(txs[1]);
        stubbedWallet.approveTokenDeposit.withArgs('1000000000.0', 'NII').resolves(txs[2]);
        stubbedWallet.completeTokenDeposit.resolves(txs[3]);
        for (let i = 0; i < txs.length; i++) {
            stubbedProviderInstance.getTransactionConfirmation
                .withArgs(txs[i].hash)
                .returns(txReceipts[i]);
        }
        erc20contractClass.from.withArgs('NII', stubbedWallet).resolves(stubbedNiiContract);
        stubbedNiiContract.balanceOf
            .withArgs(stubbedConfig.wallet.address)
            .onFirstCall().resolves('0')
            .onSecondCall().resolves('1000000000000000000000000')
            .onThirdCall().resolves('0');
        sinon.stub(console, 'log');
        sinon.stub(console, 'error');
        cmd = proxyquireCommand();
    });

    afterEach(() => {
        stubbedRevenueTokenManager.reset();
        stubbedNiiContract.reset();
        stubbedWallet.reset();
        stubbedProviderInstance.getTransactionConfirmation.reset();
        console.log.restore();
        console.error.restore();
    });

    context('no periods claimed and enough ETH to cover gas cost', () => {

        context('with default options', () => {
            context('claim nii for period 0', () => {
                it('rejects with error', done => {
                    cmd.handler
                        .call(undefined, {
                            period: '0'
                        })
                        .catch(err => {
                            expect(err.message).to.match(/period must be a number from 1 to 120/i);
                            done();
                        });
                });
            });

            context('claim nii for period 121', () => {
                it('rejects with error', done => {
                    cmd.handler
                        .call(undefined, {
                            period: '121'
                        })
                        .catch(err => {
                            expect(err.message).to.match(/period must be a number from 1 to 120/i);
                            done();
                        });
                });
            });

            context('claim nii for period 1', () => {
                beforeEach(() => {
                    return cmd.handler.call(undefined, {
                        period: '1'
                    });
                });

                it('releases fund for period 0 in RevenueTokenManager', () => {
                    expect(stubbedRevenueTokenManager.release).to.have.been.calledWith(0);
                });

                it('deposits all NII tokens in wallet to nahmii', () => {
                    expect(stubbedWallet.completeTokenDeposit).to.have.been.calledWith('1000000000.0', 'NII');
                });
            });
        });

        context('with specified timeout', () => {
            let expectedTimeout;

            beforeEach(() => {
                expectedTimeout = 120;
            });

            context('claim nii for period 1', () => {
                beforeEach(() => {
                    return cmd.handler.call(undefined, {
                        period: '1',
                        timeout: expectedTimeout.toString()
                    });
                });

                it('releases fund for period 0 in RevenueTokenManager', () => {
                    expect(stubbedRevenueTokenManager.release).to.have.been.calledWith(0);
                });

                it('deposits all NII tokens in wallet to nahmii', () => {
                    expect(stubbedWallet.completeTokenDeposit).to.have.been.calledWith('1000000000.0', 'NII');
                });

                it('uses specified timeout value when waiting for mining confirmation', () => {
                    const callCount = stubbedProviderInstance.getTransactionConfirmation.callCount;
                    for (let i = 0; i < callCount; i++)
                        expect(stubbedProviderInstance.getTransactionConfirmation.getCall(i).args[1]).to.eql(expectedTimeout);
                });
            });
        });

        context('with specified gas price', () => {
            let priceGWEI;

            beforeEach(() => {
                priceGWEI = '23';
            });

            context('claim nii for period 1', () => {
                beforeEach(() => {
                    return cmd.handler.call(undefined, {
                        period: '1',
                        price: priceGWEI
                    });
                });

                it('releases fund for period 0 in RevenueTokenManager using gas price', () => {
                    expect(stubbedRevenueTokenManager.release).to.have.been.calledWith(0, {
                        gasLimit: 800000,
                        gasPrice: ethers.utils.bigNumberify(23000000000)
                    });
                });
            });
        });
    });

    context('mining fails', () => {
        xcontext('claim can not be confirmed', () => {
            beforeEach(() => {
                stubbedProviderInstance.getTransactionConfirmation
                    .withArgs(txs[0].hash)
                    .rejects(new Error('some error'));
            });

            it('rejects with error', done => {
                cmd.handler
                    .call(undefined, {
                        period: '1'
                    })
                    .catch(err => {
                        expect(err.message).to.match(/claiming nii failed.*some error/i);
                        done();
                    });
            });
        });

        context('transfer approval can not be confirmed', () => {
            beforeEach(() => {
                stubbedProviderInstance.getTransactionConfirmation
                    .withArgs(txs[2].hash)
                    .rejects(new Error('some error'));
            });

            it('rejects with error', done => {
                cmd.handler
                    .call(undefined, {
                        period: '1'
                    })
                    .catch(err => {
                        expect(err.message).to.match(/claiming nii failed.*some error/i);
                        done();
                    });
            });
        });

        context('deposit can not be confirmed', () => {
            beforeEach(() => {
                stubbedProviderInstance.getTransactionConfirmation
                    .withArgs(txs[2].hash)
                    .rejects(new Error('some error'));
            });

            it('rejects with error', done => {
                cmd.handler
                    .call(undefined, {
                        period: '1'
                    })
                    .catch(err => {
                        expect(err.message).to.match(/claiming nii failed.*some error/i);
                        done();
                    });
            });
        });
    });
});
