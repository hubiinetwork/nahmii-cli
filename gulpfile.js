'use strict';

const gulp = require('gulp');
const shell = require('shelljs');

gulp.task('run-codeclimate', (done) => {
    if (!shell.which('docker')) {
        shell.echo('\n*** WARNING: docker is required and must be installed in order to run codeclimate\n');
        return done();
    }

    if (!shell.exec('docker images | grep codeclimate', { silent: true }).toString())
        shell.exec('docker pull codeclimate/codeclimate');

    shell.exec(`docker run \
        --tty --rm \
        --env CODECLIMATE_CODE="$PWD" \
        --volume "$PWD":/code \
        --volume /var/run/docker.sock:/var/run/docker.sock \
        --volume /tmp/cc:/tmp/cc \
        codeclimate/codeclimate analyze;
    `);

    return done();
});
