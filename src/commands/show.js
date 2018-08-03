'use strict';

module.exports = {
    command: 'show <resource>',
    describe: 'Show all available resources of type <resource>',
    builder: yargs => {
        return yargs
            .commandDir('./show-commands', {exclude: /.*.spec.js$/})
            .demandCommand()
    },
    handler: async (argv) => {}
};
