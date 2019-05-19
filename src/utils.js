'use strict';

const ethers = require('ethers');
const dbg = require('./dbg');

function parseAmount(amount, decimals) {
    let amountBN;
    try {
        amountBN = ethers.utils.parseUnits(amount, decimals);
    }
    catch (err) {
        dbg(err);
        throw new TypeError('Amount must be a number!');
    }

    if (amountBN.eq(0))
        throw new Error('Amount must be greater than zero!');

    return amountBN;
}

function parsePositiveInteger(str) {
    const number = parseInt(str);
    if (number <= 0)
        throw new Error('Gas limit/price must be a number higher than 0');
    return number;
}

function reduceReceipt(txReceipt) {
    return {
        transactionHash: txReceipt.transactionHash,
        blockNumber: txReceipt.blockNumber,
        gasUsed: ethers.utils.bigNumberify(txReceipt.gasUsed).toString(),
        href: `https://ropsten.etherscan.io/tx/${txReceipt.transactionHash}`
    };
}

module.exports = {
    parseAmount,
    parsePositiveInteger,
    reduceReceipt
};
