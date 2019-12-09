'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();

const ethers = require('ethers');

const walletID = '0x1234567890123456789012345678901234567890';
const walletID2 = '0x1234567890123456789012345678901234567891';

const stubbedPayment = sinon.stub();
const stubbedMonetaryAmount = {
    from: sinon.stub()
};

const testCurrency = {
    hbt: {
        currency: '0x0000000000000000000000000000000000000001',
        symbol: 'HBT',
        decimals: '15'
    },
    wtf: {
        currency: '0x0000000000000000000000000000000000000002',
        symbol: 'WTF',
        decimals: '7'
    }
};

const stubbedConfig = {
    wallet: {
        address: walletID2,
        secret: 'expected secret'
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
    getSupportedTokens: sinon.stub(),
    stopUpdate: sinon.stub()
};
stubbedProviderInstance.reset = function() {
    this.getSupportedTokens.reset();
    this.stopUpdate.reset();
}.bind(stubbedProviderInstance);

const stubbedWallet = {};

function proxyquireCommand() {
    return proxyquire('./pay', {
        'nahmii-sdk': {
            NahmiiProvider: fakeNahmiiProvider,
            Payment: stubbedPayment,
            Wallet: function() {
                return stubbedWallet;
            },
            MonetaryAmount: stubbedMonetaryAmount,
            utils: require('nahmii-sdk').utils
        },
        '../config': stubbedConfig
    });
}

describe('Pay command', () => {
    const registeredPayment = {expected: 'payment registration'};
    let fakePayment, fakeMoney;

    beforeEach(() => {
        sinon.stub(console, 'log');
        fakePayment = {
            sign: sinon.stub(),
            register: sinon.stub()
        };
        fakePayment.sign.resolves();
        fakePayment.register.resolves(registeredPayment);
        fakeMoney = {};
        fakeNahmiiProvider.from
            .withArgs(stubbedConfig.apiRoot, stubbedConfig.appId, stubbedConfig.appSecret)
            .resolves(stubbedProviderInstance);
    });

    afterEach(() => {
        stubbedProviderInstance.reset();
        stubbedPayment.reset();
        stubbedConfig.privateKey.reset();
        console.log.restore();
    });

    context(`pay 1000 HBT to ${walletID}`, () => {
        const expectedPrivateKey = 'a private key';

        beforeEach(async () => {
            const cmd = proxyquireCommand().handler;
            stubbedProviderInstance.getSupportedTokens
                .resolves([testCurrency.hbt, testCurrency.wtf]);
            stubbedMonetaryAmount.from
                .withArgs(
                    ethers.utils.parseUnits('1000', testCurrency.hbt.decimals),
                    testCurrency.hbt.currency
                )
                .returns(fakeMoney);
            stubbedPayment
                .withArgs(
                    fakeMoney,
                    walletID2,
                    walletID,
                    stubbedWallet
                )
                .returns(fakePayment);
            stubbedConfig.privateKey
                .withArgs(stubbedConfig.wallet.secret)
                .resolves(expectedPrivateKey);
            await cmd({
                amount: '1000',
                currency: 'HBT',
                recipient: walletID
            });
        });

        it('signs the payment', () => {
            expect(fakePayment.sign).to.have.been.calledOnce;
        });

        it('registers payment with API', () => {
            expect(fakePayment.register).to.have.been.calledOnce;
        });

        it('outputs an single receipt to stdout', () => {
            expect(console.log).to.have.been.calledWith(JSON.stringify(registeredPayment));
        });

        it('stops token refresh', () => {
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });

    context(`pay 1.1 ETH to ${walletID}`, () => {
        const expectedPrivateKey = 'a private key';

        beforeEach(async () => {
            const cmd = proxyquireCommand().handler;
            stubbedMonetaryAmount.from
                .withArgs(ethers.utils.parseEther('1.1'), '0x' + '00'.repeat(20))
                .returns(fakeMoney);

            stubbedPayment
                .withArgs(
                    fakeMoney,
                    walletID2,
                    walletID,
                    stubbedWallet
                ).returns(fakePayment);
            stubbedConfig.privateKey
                .withArgs(stubbedConfig.wallet.secret)
                .resolves(expectedPrivateKey);
            await cmd({
                amount: '1.1',
                currency: 'ETH',
                recipient: walletID
            });
        });

        it('signs the payment', () => {
            expect(fakePayment.sign).to.have.been.calledOnce;
        });

        it('registers payment with API', () => {
            expect(fakePayment.register).to.have.been.calledOnce;
        });

        it('outputs an single receipt to stdout', () => {
            expect(console.log).to.have.been.calledWith(JSON.stringify(registeredPayment));
        });

        it('stops token refresh', () => {
            expect(stubbedProviderInstance.stopUpdate).to.have.been.called;
        });
    });
});