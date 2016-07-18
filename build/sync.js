
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

/**
 * @module resinSync
 */
var MIN_HOSTOS_RSYNC, Promise, Spinner, chalk, config, ensureHostOSCompatibility, resin, rsync, semver, semverRegExp, shell, utils, _;

Promise = require('bluebird');

_ = require('lodash');

chalk = require('chalk');

resin = require('resin-sdk');

Spinner = require('resin-cli-visuals').Spinner;

rsync = require('./rsync');

utils = require('./utils');

shell = require('./shell');

config = require('./config');

semver = require('semver');

MIN_HOSTOS_RSYNC = '1.1.4';

semverRegExp = /[0-9]+\.[0-9]+\.[0-9]+(?:(-|\+)[^\s]+)?/;


/**
 * @summary Ensure HostOS compatibility
 * @function
 * @private
 *
 * @description
 * Ensures 'rsync' is installed on the target device by checking
 * HostOS version. Fullfills promise if device is compatible or
 * rejects it otherwise. Version checks are based on semver.
 *
 * @param {String} osRelease - HostOS version as returned from the API (device.os_release field)
 * @param {String} minVersion - Minimum accepted HostOS version
 * @returns {Promise}
 *
 * @example
 * ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
 * .then ->
 *		console.log('Is compatible')
 * .catch ->
 *		console.log('Is incompatible')
 */

exports.ensureHostOSCompatibility = ensureHostOSCompatibility = Promise.method(function(osRelease, minVersion) {
  var version, _ref;
  version = osRelease != null ? (_ref = osRelease.match(semverRegExp)) != null ? _ref[0] : void 0 : void 0;
  if (version == null) {
    throw new Error("Could not parse semantic version from HostOS release info: " + osRelease);
  }
  if (semver.lt(version, minVersion)) {
    throw new Error("Incompatible HostOS version: " + osRelease + " - must be >= " + minVersion);
  }
});


/**
 * @summary Sync your changes with a device
 * @function
 * @public
 *
 * @description
 * This module provides a way to sync changes from a local source
 * directory to a device. It relies on the following dependencies
 * being installed in the system:
 *
 * - `rsync`
 * - `ssh`
 *
 * You can save all the options mentioned below in a `resin-sync.yml`
 * file, by using the same option names as keys. For example:
 *
 * 	$ cat $PWD/resin-sync.yml
 * 	source: src/
 * 	before: 'echo Hello'
 * 	ignore:
 * 		- .git
 * 		- node_modules/
 * 	progress: false
 *
 * Notice that explicitly passed command options override the ones
 * set in the configuration file.
 *
 * @param {String} uuid - device uuid
 * @param {Object} [options] - options
 * @param {String} [options.source=$PWD] - source path
 * @param {String[]} [options.ignore] - ignore paths
 * @param {String} [options.before] - command to execute before sync
 * @param {Boolean} [options.progress] - display rsync progress
 * @param {Number} [options.port=22] - ssh port
 *
 * @example
 * resinSync.sync('7a4e3dc', {
 *   ignore: [ '.git', 'node_modules' ],
 *   progress: false
 * });
 */

exports.sync = function(uuid, options) {
  options = _.merge(config.load(), options);
  _.defaults(options, {
    source: process.cwd(),
    port: 22
  });
  utils.validateObject(options, {
    properties: {
      before: {
        description: 'before',
        type: 'string',
        message: 'The before option should be a string'
      }
    }
  });
  console.info("Connecting with: " + uuid);
  return resin.models.device.isOnline(uuid).then(function(isOnline) {
    if (!isOnline) {
      throw new Error('Device is not online');
    }
    return resin.models.device.get(uuid);
  }).tap(function(device) {
    return ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC);
  }).tap(function(device) {
    return Promise["try"](function() {
      if (options.before != null) {
        return shell.runCommand(options.before, {
          cwd: options.source
        });
      }
    });
  }).then(function(device) {
    return Promise.props({
      uuid: device.uuid,
      username: resin.auth.whoami()
    });
  }).then(function(_arg) {
    var spinner, username, uuid;
    uuid = _arg.uuid, username = _arg.username;
    spinner = new Spinner('Stopping application container...');
    spinner.start();
    return resin.models.device.stopApplication(uuid).then(function(containerId) {
      spinner.stop();
      if (containerId == null) {
        throw new Error('No application container id found');
      }
      return Promise["try"](function() {
        var command;
        console.log('Application container stopped.');
        spinner = new Spinner("Syncing to /usr/src/app on " + (uuid.substring(0, 7)) + "...");
        spinner.start();
        options = _.merge(options, {
          username: username,
          uuid: uuid,
          containerId: containerId
        });
        command = rsync.getCommand(options);
        return shell.runCommand(command, {
          cwd: options.source
        });
      }).then(function() {
        spinner.stop();
        console.log("Synced /usr/src/app on " + (uuid.substring(0, 7)) + ".");
        spinner = new Spinner('Starting application container...');
        spinner.start();
        return resin.models.device.startApplication(uuid);
      }).then(function() {
        spinner.stop();
        console.log('Application container started.');
        return console.log(chalk.green.bold('\nresin sync completed successfully!'));
      })["catch"](function(err) {
        spinner.stop();
        spinner = new Spinner('Attempting to restart stopped application container after failed \'resin sync\'...');
        spinner.start();
        return resin.models.device.startApplication(uuid).then(function() {
          spinner.stop();
          return console.log('Application container restarted after failed \'resin sync\'.');
        })["catch"](function(err) {
          spinner.stop();
          return console.log('Could not restart application container', err);
        })["finally"](function() {
          console.log(chalk.red.bold('resin sync failed.', err));
          return process.exit(1);
        });
      });
    })["catch"](function(err) {
      spinner.stop();
      console.log(chalk.red.bold('resin sync failed.', err));
      return process.exit(1);
    });
  });
};
