'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();

const wallet1 = '0x' + '00'.repeat(19) + '01';
const wallet2 = '0x' + '00'.repeat(19) + '02';
const wallet3 = '0x' + '00'.repeat(19) + '03';

const testPayments = [
    {
        id: '1',
        sender: {
            wallet: wallet1
        },
        recipient: {
            wallet: wallet2
        }
    },
    {
        id: '2',
        sender: {
            wallet: wallet1
        },
        recipient: {
            wallet: wallet3
        }
    },
    {
        id: '3',
        sender: {
            wallet: wallet2
        },
        recipient: {
            wallet: wallet1
        }
    },
    {
        id: '4',
        sender: {
            wallet: wallet3
        },
        recipient: {
            wallet: wallet2
        }
    },
    {
        id: '5',
        sender: {
            wallet: wallet3
        },
        recipient: {
            wallet: wallet1
        }
    }
];

const stubbedConfig = {
    wallet: {
        address: wallet1,
        secret: 'expected secret'
    },
    privateKey: sinon.stub()
};

const stubbedProvider = {
    getPendingPayments: sinon.stub(),
    stopUpdate: sinon.stub()
};

const utils = require('nahmii-sdk').utils;

function proxyquireCommand() {
    return proxyquire('./payments', {
        'nahmii-sdk': {
            NahmiiProvider: function() {
                return stubbedProvider;
            },
            utils: utils
        },
        '../../config': stubbedConfig
    });
}

describe('Show Payments command', () => {
    let showPayments;

    beforeEach(() => {
        stubbedConfig.wallet.address = wallet1;
        showPayments = proxyquireCommand().handler;
        sinon.stub(console, 'log');
    });

    afterEach(() => {
        console.log.restore();
        stubbedProvider.getPendingPayments.reset();
    });

    [utils.prefix0x(wallet1), utils.strip0x(wallet1)].forEach(myWallet => {
        context('API responds with payments', () => {
            beforeEach(async () => {
                stubbedConfig.wallet.address = myWallet;
                stubbedProvider.getPendingPayments.resolves(testPayments);
                await showPayments();
            });

            it('outputs only payments related to my wallet', () => {
                const expectedPayments = [
                    testPayments[0],
                    testPayments[1],
                    testPayments[2],
                    testPayments[4]
                ];
                expect(console.log).to.have.been.calledWith(JSON.stringify(expectedPayments));
            });

            it('stops token refresh', () => {
                expect(stubbedProvider.stopUpdate).to.have.been.called;
            });
        });
    });

    context('API responds with something other than an array', () => {
        beforeEach(async () => {
            stubbedProvider.getPendingPayments.resolves({});
            await showPayments();
        });

        it('outputs empty array', () => {
            const expectedPayments = [];
            expect(console.log).to.have.been.calledWith(JSON.stringify(expectedPayments));
        });

        it('stops token refresh', () => {
            expect(stubbedProvider.stopUpdate).to.have.been.called;
        });
    });

    context('API responds with error', () => {
        let error;

        beforeEach((done) => {
            stubbedProvider.getPendingPayments.rejects();
            showPayments()
                .catch(err => {
                    error = err;
                    done();
                });
        });

        it('outputs empty array', () => {
            expect(error.message).to.match(/show.*pending.*payments/i);
        });

        it('stops token refresh', () => {
            expect(stubbedProvider.stopUpdate).to.have.been.called;
        });
    });
});
