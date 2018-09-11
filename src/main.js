#!/usr/bin/env node

const argv = require('yargs')
    .commandDir('./commands', {exclude: /.*.spec.js$/})
    .fail((msg, err, yargs) => {
        if (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err.stack);
            else
                console.error('Error: ' + err.message);
        }
        else
            console.error(msg);
        process.exit(1);
    })
    .demandCommand()
    .help()
    .argv;
