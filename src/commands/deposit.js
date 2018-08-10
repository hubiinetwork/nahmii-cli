'use strict';

const web3utils = require('web3-utils');
const Web3Eth = require('web3-eth');
const ethers = require('ethers');
const {prefix0x} = require('../sdk/utils');

let isProviderConnected = async function(provider) {
    await provider.getBlockNumber();
    return true;
};

function dbg(...args) {
    if (process.env.LOG_LEVEL === 'debug')
        console.error(...args);
}

Promise.retry = function(attemptFn, times, delay) {
    return new Promise(function(resolve, reject) {
        let error;

        function attempt() {
            if (!times)
                return reject(error);

            attemptFn()
                .then(resolve)
                .catch(function(e) {
                    times--;
                    error = e;
                    setTimeout(function() {
                        attempt()
                    }, delay);
                });
        }

        attempt();
    });
};

function isNotNull(promise) {
    return new Promise((resolve, reject) => {
        promise.then(res => {
            if (res !== null)
                resolve(res);
            else
                reject();
        })
    });
}


module.exports = {
    command: 'deposit <amount> <currency> [--gas=<gaslimit>]',
    describe: 'Deposits <amount> of ETH (or any supported token) into your striim account.',
    builder: yargs => {
        yargs.example('deposit 1 ETH', 'Deposits 1 Ether using default gas limit.');
        yargs.example('deposit 1 ETH --gas=500000', 'Deposits 1 Ether and sets the gas limit to 500000.');
        yargs.example('deposit 1000 HBT', 'Deposits 1000 Hubiits (HBT) using default gas limit.');
        yargs.option('gas', {
            desc: 'Gas limit used _per transaction_. Deposits can be 1 or more transactions depending on the type of currency.',
            default: 250000,
            type: 'number'
        });
    },
    handler: async (argv) => {
        const {createApiToken} = require('../sdk/identity-model');
        const config = require('../config');

        const gasLimit = parseInt(argv.gas);
        if (gasLimit <= 0)
            throw new Error('Gas limit must be a number higher than 0');

        const secret = config.wallet.secret;
        const privateKey = prefix0x(config.privateKey(secret));

        let network = 'homestead';
        if (config.ethereum && config.ethereum.node)
            network = config.ethereum.node;
        dbg('Network: ' + network);

        let provider;
        if (config.ethereum && config.ethereum.node)
            provider = ethers.providers.getDefaultProvider(config.ethereum.network);
        else
            provider = new ethers.providers.JsonRpcProvider(config.ethereum.node, config.ethereum.network);
        dbg(JSON.stringify(provider));

        try {
            await isProviderConnected(provider);
        }
        catch (err) {
            dbg(err);
            throw new Error('Unable to connect to provider!');
        }

        const wallet = new ethers.Wallet(privateKey, provider);

        const ClientFundContract = require('../client-fund-contract');
        const clientFund = new ClientFundContract(wallet);

        if (argv.currency.toUpperCase() === 'ETH') {
            const amount = ethers.utils.parseEther(argv.amount.toString());
            dbg('Sending ' + amount + ' wei to ' + clientFund.address + ' from ' + wallet.address);

            const transaction = await wallet.send(clientFund.address, amount, {gasLimit: gasLimit});
            console.log(JSON.stringify({
                transaction: transaction,
                href: 'https://ropsten.etherscan.io/tx/' + transaction.hash
            }));
        }
        else {
            const {getSupportedTokens} = require('../sdk/tokens-model');
            const authToken = await createApiToken();
            const supportedTokens = await getSupportedTokens(authToken);

            const tokenInfo = supportedTokens.find(t => t.symbol.toUpperCase() === argv.currency.toUpperCase());
            if (!tokenInfo)
                throw new Error('Unknown currency. See "striim show tokens" for a list of supported tokens.');

            const amount = ethers.utils.parseUnits(argv.amount.toString(), tokenInfo.decimals);
            dbg('Sending ' + amount + ' (base units) to ' + clientFund.address + ' from ' + wallet.address);

            const Erc20Contract = require('../erc20-contract');
            const tokenContract = new Erc20Contract(tokenInfo.currency, wallet);

            try {
                dbg('Approving transfer...');
                var approvalTx = await tokenContract.approve(clientFund.address, amount, {gasLimit: gasLimit});
                dbg('ApproveTX: ' + JSON.stringify(approvalTx));

                var approvalTxReceipt = await Promise.retry(() => {
                    dbg('.');
                    return isNotNull(provider.getTransactionReceipt(approvalTx.hash))
                }, 60, 1000);
                dbg('ApproveTX (receipt): ' + JSON.stringify(approvalTxReceipt));
            }
            catch (err) {
                dbg(err);
                throw new Error('Failed to approve ERC20 token payment in time!')
            }

            if (approvalTxReceipt.status === 0)
                throw new Error('Approve transaction failed!');

            try {
                dbg('Depositing to striim...');
                var depositTx = await clientFund.depositTokens(tokenContract.address, amount, {gasLimit: gasLimit});
                dbg('DepositTX: ' + JSON.stringify(depositTx));

                var depositTxReceipt = await Promise.retry(() => {
                    dbg('.');
                    return isNotNull(provider.getTransactionReceipt(depositTx.hash))
                }, 60, 1000);
                dbg('DepositTX (receipt): ' + JSON.stringify(depositTxReceipt));
            }
            catch (err) {
                dbg(err);
                throw new Error('Failed to deposit token in time!')
            }

            if (depositTxReceipt.status === 0)
                throw new Error('Deposit transaction failed!');

            console.log(JSON.stringify({
                approval: approvalTxReceipt,
                deposit: depositTxReceipt,
                href: [
                    'https://ropsten.etherscan.io/tx/' + approvalTx.hash,
                    'https://ropsten.etherscan.io/tx/' + depositTx.hash
                ]
            }));
        }
    }
};
