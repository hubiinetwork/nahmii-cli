'use strict';

const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

const proxyquire = require('proxyquire').noPreserveCache().noCallThru();

const fakeContractDeployment = {
    networks: {
        '123456789': {
            address: 'some address'
        }
    },
    abi: []
};

class Contract {
    constructor(addr, abi, signerOrProvider) {
        this.addr = addr;
        this.abi = abi;
        this.signerOrProvider = signerOrProvider;
    }
}

const fakeEthers = {
    Contract
};

const RevenueTokenManagerContract = proxyquire('./revenue-token-manager-contract', {
    'ethers': fakeEthers,
    './abis/ropsten/RevenueTokenManager': fakeContractDeployment
});

const fakeProvider = {
    network: {
        chainId: '123456789',
        name: 'ropsten'
    }
};

const fakeWallet = {
    provider: fakeProvider
};

describe('RevenueTokenManagerContract', () => {
    [
        ['wallet', fakeWallet],
        ['provider', fakeProvider]
    ].forEach(([description, walletOrProvider]) => {
        context('with ' + description, () => {
            let contract;

            beforeEach(() => {
                contract = new RevenueTokenManagerContract(walletOrProvider);
            });

            it('is an instance of Contract', () => {
                expect(contract).to.be.an.instanceOf(Contract);
            });

            it('uses correct contract address in construction', () => {
                expect(contract.addr).to.eql(fakeContractDeployment.networks['123456789'].address);
                expect(contract.abi).to.eql(fakeContractDeployment.abi);
                expect(contract.signerOrProvider).to.equal(walletOrProvider);
            });
        });
    });
});
