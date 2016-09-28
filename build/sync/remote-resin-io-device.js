
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
var MIN_HOSTOS_RSYNC, Promise, Spinner, chalk, config, ensureHostOSCompatibility, form, prepareOptions, resin, rsync, saveOptions, semver, semverRegExp, shell, utils, _;

Promise = require('bluebird');

_ = require('lodash');

chalk = require('chalk');

resin = require('resin-sdk');

Spinner = require('resin-cli-visuals').Spinner;

form = require('resin-cli-form');

rsync = require('../rsync');

utils = require('../utils');

shell = require('../shell');

config = require('../config');

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

ensureHostOSCompatibility = Promise.method(function(osRelease, minVersion) {
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
 * @summary Prepare and validate options from command line and `.resin-sync.yml` (if found)
 * @function
 * @private
 *
 * @param {String} uuid
 * @param {String} cliOptions - cli options passed by the user
 * @returns {Promise} options - the options to use for this resin sync run
 *
 */

prepareOptions = Promise.method(function(uuid, cliOptions) {
  utils.validateObject(cliOptions, {
    properties: {
      source: {
        description: 'source',
        type: 'any',
        required: true,
        message: 'The source option should be a string'
      },
      before: {
        description: 'before',
        type: 'string',
        message: 'The before option should be a string'
      },
      after: {
        description: 'after',
        type: 'string',
        message: 'The after option should be a string'
      }
    }
  });
  return Promise["try"](function() {
    var configFileOptions;
    configFileOptions = config.load(cliOptions.source);
    if (!_.isEmpty(configFileOptions)) {
      return configFileOptions;
    }
    try {
      this.oldConfigFileOptions = config.load(cliOptions.source, 'resin-sync.yml');
      if (_.isEmpty(this.oldConfigFileOptions)) {
        return {};
      }
    } catch (_error) {
      return {};
    }
    return form.ask({
      message: 'A \'resin-sync.yml\' configuration file was found, but the current resin-cli version expects a \'.resin-sync.yml\' file instead.\nConvert \'resin-sync.yml\' to \'.resin-sync.yml\' (the original file will be kept either way) ?',
      type: 'list',
      choices: ['Yes', 'No']
    }).then(function(answer) {
      if (answer === 'No') {
        return {};
      } else {
        saveOptions(this.oldConfigFileOptions, cliOptions.source, '.resin-sync.yml');
        return config.load(cliOptions.source);
      }
    });
  }).then(function(loadedOptions) {
    var options;
    options = {};
    _.mergeWith(options, loadedOptions, cliOptions, {
      uuid: uuid
    }, function(objVal, srcVal) {
      if (_.isArray(objVal)) {
        return srcVal;
      }
    });
    return form.run([
      {
        message: 'Destination directory on device [/usr/src/app]',
        name: 'destination',
        type: 'input'
      }
    ], {
      override: {
        destination: options.destination
      }
    }).get('destination').then(function(dest) {
      _.defaults(options, {
        destination: dest != null ? dest : '/usr/src/app',
        port: 22
      });
      options.ignore = _.filter(options.ignore, function(item) {
        return !_.isEmpty(item);
      });
      if (options.ignore.length === 0 && (loadedOptions.ignore == null)) {
        options.ignore = ['.git', 'node_modules/'];
      }
      return options;
    });
  });
});


/**
 * @summary Save passed options to '.resin-sync.yml' in 'source' folder
 * @function
 * @private
 *
 * @param {String} options - options to save to `.resin-sync.yml`
 * @returns {Promise} - Promise is rejected if file could not be saved
 *
 */

saveOptions = Promise.method(function(options, baseDir, configFile) {
  return config.save(_.pick(options, ['uuid', 'destination', 'port', 'before', 'after', 'ignore', 'skip-gitignore']), baseDir != null ? baseDir : options.source, configFile != null ? configFile : '.resin-sync.yml');
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
 * @param {String} uuid - device uuid
 * @param {Object} [cliOptions] - cli options
 * @param {String[]} [cliOptions.source] - source directory on local host
 * @param {String[]} [cliOptions.destination=/usr/src/app] - destination directory on device
 * @param {String[]} [cliOptions.ignore] - ignore paths
 * @param {String[]} [cliOptions.skip-gitignore] - skip .gitignore when parsing exclude/include files
 * @param {String} [cliOptions.before] - command to execute before sync
 * @param {String} [cliOptions.after] - command to execute after sync
 * @param {Boolean} [cliOptions.progress] - display rsync progress
 * @param {Number} [cliOptions.port=22] - ssh port
 *
 * @example
 * resinSync('7a4e3dc', {
 *		source: '.',
 *		destination: '/usr/src/app',
 *   ignore: [ '.git', 'node_modules' ],
 *   progress: false
 * });
 */

module.exports = function(uuid, cliOptions) {
  var afterAction, beforeAction, clearSpinner, getDeviceInfo, spinnerPromise, startContainer, startContainerAfterError, stopContainer, syncContainer, syncOptions;
  syncOptions = {};
  clearSpinner = function(spinner, msg) {
    if (spinner != null) {
      spinner.stop();
    }
    if (msg != null) {
      return console.log(msg);
    }
  };
  spinnerPromise = function(promise, startMsg, stopMsg) {
    var spinner;
    spinner = new Spinner(startMsg);
    spinner.start();
    return promise.then(function(value) {
      clearSpinner(spinner, stopMsg);
      return value;
    })["catch"](function(err) {
      clearSpinner(spinner);
      throw err;
    });
  };
  getDeviceInfo = function() {
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
      }).then(_.partial(_.merge, syncOptions));
    });
  };
  beforeAction = function() {
    return Promise["try"](function() {
      if (syncOptions.before != null) {
        return shell.runCommand(syncOptions.before, {
          cwd: syncOptions.source
        });
      }
    });
  };
  afterAction = function() {
    return Promise["try"](function() {
      if (syncOptions.after != null) {
        return shell.runCommand(syncOptions.after, {
          cwd: syncOptions.source
        });
      }
    });
  };
  stopContainer = function() {
    uuid = syncOptions.uuid;
    return spinnerPromise(resin.models.device.stopApplication(uuid), 'Stopping application container...', 'Application container stopped.').then(function(containerId) {
      return _.merge(syncOptions, {
        containerId: containerId
      });
    });
  };
  syncContainer = Promise.method(function() {
    var command, containerId, destination, source;
    uuid = syncOptions.uuid, containerId = syncOptions.containerId, source = syncOptions.source, destination = syncOptions.destination;
    if (containerId == null) {
      throw new Error('No stopped application container found');
    }
    command = rsync.getCommand(syncOptions);
    return spinnerPromise(shell.runCommand(command, {
      cwd: source
    }), "Syncing to " + destination + " on " + (uuid.substring(0, 7)) + "...", "Synced " + destination + " on " + (uuid.substring(0, 7)) + ".");
  });
  startContainer = function() {
    uuid = syncOptions.uuid;
    return spinnerPromise(resin.models.device.startApplication(uuid), 'Starting application container...', 'Application container started.');
  };
  startContainerAfterError = function() {
    uuid = syncOptions.uuid;
    return spinnerPromise(resin.models.device.startApplication(uuid), 'Attempting to restart stopped application container after failed \'resin sync\'...', 'Application container restarted after failed \'resin sync\'.');
  };
  return prepareOptions(uuid, cliOptions).then(_.partial(_.merge, syncOptions)).then(getDeviceInfo).then(function() {
    return saveOptions(syncOptions);
  }).then(beforeAction).then(stopContainer).then(function() {
    return syncContainer().then(startContainer).then(afterAction).then(function() {
      return console.log(chalk.green.bold('\nresin sync completed successfully!'));
    })["catch"](function(err) {
      return startContainerAfterError()["catch"](function(err) {
        return console.log('Could not restart application container', err);
      })["finally"](function() {
        throw err;
      });
    });
  })["catch"](function(err) {
    console.log(chalk.red.bold('resin sync failed.', err));
    return process.exit(1);
  });
};
