'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const ethers = require('ethers');

const stubbedIdentityModel = {
    createApiToken: sinon.stub()
};

const stubbedWallet = {
    depositEth: sinon.stub(),
    depositToken: sinon.stub()
};

const stubbedConfig = {
    wallet: {
        secret: 'secret much'
    },
    ethereum: {
        node: 'such node',
        network: 'such network'
    },
    privateKey: sinon.stub()
};

const stubbedEthers = {
    providers: {
        JsonRpcProvider: sinon.stub(),
        getDefaultProvider: sinon.stub()
    },
    utils: ethers.utils
};

const stubbedProvider = {
    getBlockNumber: sinon.stub()
};

function proxyquireCommand() {
    return proxyquire('./deposit', {
        'ethers': stubbedEthers,
//        '../sdk/utils': ,
        '../config': stubbedConfig,
        '../sdk/wallet': function() {
            return stubbedWallet;
        },
        '../sdk/identity-model': stubbedIdentityModel
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
        stubbedEthers.providers.JsonRpcProvider
            .withArgs(stubbedConfig.ethereum.node, stubbedConfig.ethereum.network)
            .returns(stubbedProvider);
        stubbedEthers.providers.getDefaultProvider
            .withArgs(stubbedConfig.ethereum.network)
            .returns(stubbedProvider);
        stubbedProvider.getBlockNumber.resolves(1);
        sinon.stub(console, 'log');
        depositCmd = proxyquireCommand();
        stubbedWallet.depositEth.resolves(txReceipt1);
        stubbedWallet.depositToken.resolves([txReceipt1, txReceipt2]);
    });

    afterEach(() => {
        stubbedIdentityModel.createApiToken.reset();
        stubbedWallet.depositEth.reset();
        stubbedWallet.depositToken.reset();
        stubbedConfig.privateKey.reset();
        stubbedEthers.providers.JsonRpcProvider.reset();
        stubbedEthers.providers.getDefaultProvider.reset();
        stubbedProvider.getBlockNumber.reset();
        console.log.restore();
    });

    context('deposit 1.2 ETH', () => {
        beforeEach(() => {
            return depositCmd.handler.call(undefined, {
                amount: 1.2,
                currency: 'ETH',
                gas: 2
            });
        });

        it('tells wallet to deposit 1.2 ETH', () => {
            expect(stubbedWallet.depositEth).to.have.been.calledWith(1.2, {gasLimit: 2})
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
    });

    context('deposit 3.14 TT1', () => {
        beforeEach(() => {
            return depositCmd.handler.call(undefined, {
                amount: 3.14,
                currency: 'TT1',
                gas: 2
            });
        });

        it('tells wallet to deposit 3.14 TT1', () => {
            expect(stubbedWallet.depositToken).to.have.been.calledWith(3.14, 'TT1', {gasLimit: 2})
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
    });

    context('deposit 0 ETH', () => {
        it('yields an error', (done) => {
            depositCmd.handler
                .call(undefined, {
                    amount: 0,
                    currency: 'ETH',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.match(/amount.*zero/i);
                    done();
                });
        });
    });

    context('wallet fails to deposit ETH', () => {
        it('yields an error', (done) => {
            stubbedWallet.depositEth.reset();
            stubbedWallet.depositEth.rejects(new Error('transaction failed'));
            depositCmd.handler
                .call(undefined, {
                    amount: 1.2,
                    currency: 'ETH',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.eql('transaction failed');
                    done();
                });
        });
    });

    context('wallet fails to deposit token', () => {
        it('yields an error', (done) => {
            stubbedWallet.depositToken.reset();
            stubbedWallet.depositToken.rejects(new Error('transaction failed'));

            depositCmd.handler
                .call(undefined, {
                    amount: 1.2,
                    currency: 'TT1',
                    gas: 2
                })
                .catch(err => {
                    expect(err.message).to.eql('transaction failed');
                    done();
                });
        });
    });
});
