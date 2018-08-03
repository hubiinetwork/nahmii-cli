'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();

const walletID = '0x1234567890123456789012345678901234567890';
const walletID2 = '0x1234567890123456789012345678901234567891';

const stubbedIdentityModel = {
    createApiToken: sinon.stub()
};

const stubbedPayment = sinon.stub();

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

const stubbedTokensModel = {
    getSupportedTokens: sinon.stub()
};

const stubbedConfig = {
    wallet: {
        address: walletID2,
        secret: 'expected secret'
    },
    privateKey: sinon.stub()
};

function proxyquireCommand() {
    return proxyquire('./pay', {
        '../sdk/identity-model': stubbedIdentityModel,
        '../sdk/tokens-model': stubbedTokensModel,
        '../sdk/payment-model': stubbedPayment,
        '../sdk/utils': require('../sdk/utils'),
        '../config': stubbedConfig
    });
}

describe('Pay command', () => {
    let apiToken;

    beforeEach(() => {
        apiToken = 'the expected api token';
        stubbedIdentityModel.createApiToken.resolves(apiToken);
    });

    afterEach(() => {
        stubbedIdentityModel.createApiToken.reset();
        stubbedPayment.reset();
        stubbedTokensModel.getSupportedTokens.reset();
        stubbedConfig.privateKey.reset();
    });

    context(`pay 1000 HBT to ${walletID}`, () => {
        const expectedPrivateKey = 'a private key';
        let fakePayment;

        beforeEach(async () => {
            let cmd = proxyquireCommand().handler;
            stubbedTokensModel.getSupportedTokens.resolves([testCurrency.hbt, testCurrency.wtf]);
            fakePayment = {
                sign: sinon.stub(),
                register: sinon.stub()
            };
            stubbedPayment
                .withArgs(
                    (1000 * 10 ** testCurrency.hbt.decimals).toString(),
                    testCurrency.hbt.currency,
                    walletID2,
                    walletID
                ).returns(fakePayment);
            stubbedConfig.privateKey
                .withArgs(stubbedConfig.wallet.secret)
                .returns(expectedPrivateKey);
            await cmd({
                amount: 1000,
                currency: 'HBT',
                recipient: walletID
            });
        });

        it('signs the payment given secret from configuration', () => {
            expect(fakePayment.sign).to.have.been.calledWith(expectedPrivateKey);
        });

        it('registers payment with API', () => {
            expect(fakePayment.register).to.have.been.calledWith(apiToken);
        });
    });
});
