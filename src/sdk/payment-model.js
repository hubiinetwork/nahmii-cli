'use strict';

const request = require('superagent');
const config = require('../config');
const {hash, sign} = require('./utils');

const _amount = new WeakMap();
const _currency = new WeakMap();
const _sender = new WeakMap();
const _recipient = new WeakMap();
const _hash = new WeakMap();
const _signature = new WeakMap();

class Payment {
    constructor(amount, currency, sender, recipient) {
        _amount.set(this, amount);
        _currency.set(this, currency);
        _sender.set(this, sender);
        _recipient.set(this, recipient);
    }

    sign(privateKey) {
        const h = hash(_amount.get(this), _currency.get(this), _sender.get(this), _recipient.get(this));
        const s = sign(h, privateKey);

        _hash.set(this, h);
        _signature.set(this, s);
    }

    register(authToken) {
        return Payment.registerPayment(authToken, this.toJSON());
    }

    toJSON() {
        const result = {
            amount: _amount.get(this),
            currency: _currency.get(this),
            sender: {
                addr: _sender.get(this)
            },
            recipient: {
                addr: _recipient.get(this)
            }
        };

        const hash = _hash.get(this);
        const signature = _signature.get(this);

        if (hash && signature)
            result.seals = {wallet: {hash, signature}};

        return result;
    }

    static from(payload) {
        const p = new Payment(payload.amount, payload.currency, payload.sender.addr, payload.recipient.addr);
        if (payload.seals && payload.seals.wallet) {
            _hash.set(p, payload.seals.wallet.hash);
            _signature.set(p, payload.seals.wallet.signature);
        }
        return p;
    }

    static getPendingPayments(authToken) {
        return request
            .get(`https://${config.apiRoot}/trading/payments`)
            .set('authorization', `Bearer ${authToken}`)
            .then(res => res.body);
    }

    static registerPayment(authToken, payment) {
        return request
            .post(`https://${config.apiRoot}/trading/payments`)
            .send(payment)
            .set('authorization', `Bearer ${authToken}`)
            .then(res => res.body)
            .catch(err => {
                switch (err.status) {
                    case 402:
                        throw new Error('Insufficient funds!');
                    case 403:
                        throw new Error('Not authorized!');
                    default:
                        throw new Error(err);
                }
            });
    }
}

module.exports = Payment;
