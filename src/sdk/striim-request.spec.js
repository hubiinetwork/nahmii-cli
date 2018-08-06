'use strict';

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();
const nock = require('nock');
nock.disableNetConnect();

const {prefixSlash} = require('./utils');

const fakeConfig = {
    apiRoot: 'some.hubii.server'
};

describe('#getFromStriim()', () => {
    let getFromStriim, testToken;

    beforeEach(() => {
        getFromStriim = proxyquire('./striim-request', {
            '../config': fakeConfig
        }).get;
        testToken = 'some token';
    });

    afterEach(() => {
        nock.cleanAll();
    });

    ['test/uri', '/test/uri'].forEach(uri => {
        context('with authToken and an uri: ' + uri, () => {
            it('sets the authorization header', async () => {
                let scope = nock('https://' + fakeConfig.apiRoot)
                    .matchHeader('authorization', `Bearer ${testToken}`)
                    .get(prefixSlash(uri))
                    .reply(200);
                let result = await getFromStriim(uri, testToken);
                expect(scope.isDone()).to.eql(true);
            });

            it('it inserts the missing slash into the request', async () => {
                let scope = nock('https://' + fakeConfig.apiRoot)
                    .get(prefixSlash(uri))
                    .reply(200);
                let result = await getFromStriim(uri, testToken);
                expect(scope.isDone()).to.eql(true);
            });

            it('it resolves with the body of the response', async () => {
                const expectedBody = ['item 1', 'item 2'];
                let scope = nock('https://' + fakeConfig.apiRoot)
                    .get(prefixSlash(uri))
                    .reply(200, expectedBody);
                let result = await getFromStriim(uri, testToken);
                expect(scope.isDone()).to.eql(true);
                expect(result).to.eql(expectedBody);
            });
        });
    });
});
