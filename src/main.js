#!/usr/bin/env node
'use strict';

require('yargs')
    .commandDir('./commands', {exclude: /.*.spec.js$/})
    .fail((msg, err) => {
        if (err) {
            if (process.env.LOG_LEVEL === 'debug')
                console.error(err.stack);
            else
                console.error('Error: ' + err.message);
        }
        else {
            console.error(msg);
        }
        process.exit(1);
    })
    .demandCommand()
    .help();
