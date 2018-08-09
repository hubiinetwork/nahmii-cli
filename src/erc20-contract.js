'use strict';

const ethers = require('ethers');
const erc20Abi = require('../abis/Erc20');

class Erc20Contract extends ethers.Contract {
    constructor(contractAddress, walletOrProvider) {
        super(contractAddress, erc20Abi, walletOrProvider);
    }
}

module.exports = Erc20Contract;
