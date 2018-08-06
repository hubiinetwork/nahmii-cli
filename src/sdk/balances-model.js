'use strict';

const {prefix0x} = require('./utils');
const striim = require('./striim-request');

function getStriimBalances(authToken, address) {
    return striim.get(`/trading/wallets/${prefix0x(address)}/balances`, authToken);
}

module.exports = {getStriimBalances};
