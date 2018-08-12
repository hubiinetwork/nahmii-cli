'use strict';

const request = require('superagent');
const {prefixSlash} = require('./utils');

const _authProvider = new WeakMap();

module.exports = class StriimRequest {
    constructor(apiRoot, authProvider) {
        _authProvider.set(this, authProvider);
        this.apiRoot = apiRoot;
    }

    async get(uri) {
        const authToken = await _authProvider.get(this)();
        return request
            .get(`https://${this.apiRoot}${prefixSlash(uri)}`)
            .set('authorization', `Bearer ${authToken}`)
            .then(res => res.body);
    }
};
