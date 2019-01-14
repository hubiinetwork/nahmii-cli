'use strict';

const ethers = require('ethers');

class RevenueTokenManagerContract extends ethers.Contract {
    constructor(walletOrProvider) {
        const provider = walletOrProvider.provider || walletOrProvider;
        const deployment = require(`./abis/${provider.network.name}/RevenueTokenManager`);
        const address = deployment.networks[provider.network.chainId].address;

        super(address, deployment.abi, walletOrProvider);
    }
}

module.exports = RevenueTokenManagerContract;
