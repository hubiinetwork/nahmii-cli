'use strict';

module.exports = {
    command: 'show <balance|payments|receipts|tokens|claimable amount>',
    describe: 'Display information about specified resource',
    builder: yargs => {
        return yargs
            .commandDir('./show-commands', {exclude: /.*.spec.js$/})
            .demandCommand();
    },
    handler: async () => {}
};
