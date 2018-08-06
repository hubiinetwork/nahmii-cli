'use strict';

const striim = require('./striim-request');

function getSupportedTokens(authToken) {
    return striim.get('/ethereum/supported-tokens', authToken);
}

module.exports = {getSupportedTokens};
