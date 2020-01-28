'use strict';

module.exports = {
    command: 'claim <nii|fees>',
    describe: 'Claim specified resource',
    builder: yargs => {
        return yargs
            .commandDir('./claim-commands', {exclude: /.*.spec.js$/})
            .demandCommand();
    },
    handler: async () => {}
};
