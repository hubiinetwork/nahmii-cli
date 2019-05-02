'use strict';

const ethers = require('ethers');

const ropstenAbstractions = require('nahmii-contract-abstractions-ropsten');
const homesteadAbstractions = require('nahmii-contract-abstractions');

function getAbstraction(networkName, contractName) {
    switch (networkName) {
    case 'ropsten':
        return ropstenAbstractions.getAbstraction(contractName);
    case 'homestead':
        return homesteadAbstractions.getAbstraction(contractName);
    default:
        throw new Error(`Unknown network name: ${networkName}`);
    }
}

class RevenueTokenManagerContract extends ethers.Contract {
    constructor(walletOrProvider) {
        const provider = walletOrProvider.provider || walletOrProvider;
        const deployment = getAbstraction(provider.network.name, 'RevenueTokenManager');
        const address = deployment.networks[provider.network.chainId].address;
        super(address, deployment.abi, walletOrProvider);
    }
}

module.exports = RevenueTokenManagerContract;
