
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
var MIN_HOSTOS_RSYNC, Promise, buildRsyncCommand, chalk, ensureHostOSCompatibility, resin, semver, semverRegExp, settings, shell, spinnerPromise, startContainer, startContainerAfterError, stopContainer, _, _ref;

Promise = require('bluebird');

_ = require('lodash');

chalk = require('chalk');

semver = require('semver');

resin = require('resin-sdk');

settings = require('resin-settings-client');

shell = require('../shell');

buildRsyncCommand = require('../rsync').buildRsyncCommand;

_ref = require('../utils'), spinnerPromise = _ref.spinnerPromise, startContainer = _ref.startContainer, stopContainer = _ref.stopContainer, startContainerAfterError = _ref.startContainerAfterError;

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

ensureHostOSCompatibility = Promise.method(function(osRelease, minVersion) {
  var version, _ref1;
  version = osRelease != null ? (_ref1 = osRelease.match(semverRegExp)) != null ? _ref1[0] : void 0 : void 0;
  if (version == null) {
    throw new Error("Could not parse semantic version from HostOS release info: " + osRelease);
  }
  if (semver.lt(version, minVersion)) {
    throw new Error("Incompatible HostOS version: " + osRelease + " - must be >= " + minVersion);
  }
});

exports.ensureDeviceIsOnline = function(uuid) {
  return resin.models.device.get(uuid).then(function(device) {
    if (!device.is_online) {
      throw new Error("Device is offline: " + uuid);
    }
    return uuid;
  });
};


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
 * 	destination: '/usr/src/app/'
 * 	before: 'echo Hello'
 * 	after: 'echo Done'
 * 	port: 22
 * 	ignore:
 * 		- .git
 * 		- node_modules/
 *
 * Notice that explicitly passed command options override the ones
 * set in the configuration file.
 *
 * @param {Object} [syncOptions] - cli options
 * @param {String} [syncOptions.uuid] - device uuid
 * @param {String} [syncOptions.source] - source directory on local host
 * @param {String} [syncOptions.destination=/usr/src/app] - destination directory on device
 * @param {Number} [syncOptions.port] - ssh port
 * @param {String} [syncOptions.before] - command to execute before sync
 * @param {String} [syncOptions.after] - command to execute after sync
 * @param {String[]} [syncOptions.ignore] - ignore paths
 * @param {Boolean} [syncOptions.skip-gitignore] - skip .gitignore when parsing exclude/include files
 * @param {Boolean} [syncOptions.progress] - display rsync progress
 * @param {Boolean} [syncOptions.verbose] - display verbose info
 *
 * @example
 * sync({
 *		uuid: '7a4e3dc',
 *		source: '.',
 *		destination: '/usr/src/app',
 *   ignore: [ '.git', 'node_modules' ],
 *   progress: false
 * });
 */

exports.sync = function(syncOptions) {
  var after, before, getDeviceInfo, source, syncContainer, uuid;
  getDeviceInfo = function() {
    var uuid;
    uuid = syncOptions.uuid;
    console.info("Getting information for device: " + uuid);
    return resin.models.device.isOnline(uuid).then(function(isOnline) {
      if (!isOnline) {
        throw new Error('Device is not online');
      }
      return resin.models.device.get(uuid);
    }).tap(function(device) {
      return resin.auth.getUserId().then(function(userId) {
        if (userId !== device.user.__id) {
          throw new Error('Resin sync is permitted to the device owner only. The device owner is the user who provisioned it.');
        }
      });
    }).tap(function(device) {
      return ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC);
    }).then(function(device) {
      return Promise.props({
        uuid: device.uuid,
        username: resin.auth.whoami()
      }).then(_.partial(_.assign, syncOptions));
    });
  };
  syncContainer = Promise.method(function() {
    var command, containerId, destination, source, uuid;
    uuid = syncOptions.uuid, containerId = syncOptions.containerId, source = syncOptions.source, destination = syncOptions.destination;
    if (containerId == null) {
      throw new Error('No stopped application container found');
    }
    _.assign(syncOptions, {
      host: "ssh." + (settings.get('proxyUrl')),
      'remote-cmd': "rsync " + uuid + " " + containerId
    });
    command = buildRsyncCommand(syncOptions);
    return spinnerPromise(shell.runCommand(command, {
      cwd: source
    }), "Syncing to " + destination + " on " + (uuid.substring(0, 7)) + "...", "Synced " + destination + " on " + (uuid.substring(0, 7)) + ".");
  });
  source = syncOptions.source, uuid = syncOptions.uuid, before = syncOptions.before, after = syncOptions.after;
  return getDeviceInfo().then(function() {
    if (before != null) {
      return shell.runCommand(before, source);
    }
  }).then(function() {
    return stopContainer(resin.models.device.stopApplication(uuid)).then(function(containerId) {
      return _.assign(syncOptions, {
        containerId: containerId
      });
    });
  }).then(function() {
    return syncContainer().then(function() {
      return startContainer(resin.models.device.startApplication(uuid));
    }).then(function() {
      if (after != null) {
        return shell.runCommand(after, source);
      }
    }).then(function() {
      return console.log(chalk.green.bold('\nresin sync completed successfully!'));
    })["catch"](function(err) {
      return startContainerAfterError(resin.models.device.startApplication(uuid))["catch"](function(err) {
        return console.log('Could not start application container', err);
      })["finally"](function() {
        throw err;
      });
    });
  })["catch"](function(err) {
    console.log(chalk.red.bold('resin sync failed.', err));
    return process.exit(1);
  });
};
