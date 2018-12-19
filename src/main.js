#!/usr/bin/env node
'use strict';
const ora = require('ora');
const spinner = ora();

// eslint-disable-next-line no-unused-vars
const argv = require('yargs')
    .commandDir('./commands', {exclude: /.*.spec.js$/})
    .fail((msg, err) => {
        if (err) {
            if (process.env.LOG_LEVEL === 'debug')
                spinner.fail(err.stack);
            else
                spinner.fail('Error: ' + err.message);
        }
        else {
            spinner.fail(msg);
        }
        process.exit(1);
    })
    .demandCommand()
    .help()
    .argv;
