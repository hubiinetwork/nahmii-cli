'use strict';

module.exports = function dbg(...args) {
    if (process.env.LOG_LEVEL === 'debug')
        console.error(...args);
};
