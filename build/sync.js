
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
var Promise, config, resin, rsync, shell, ssh, utils, _;

Promise = require('bluebird');

_ = require('lodash');

resin = require('resin-sdk');

rsync = require('./rsync');

utils = require('./utils');

shell = require('./shell');

ssh = require('./ssh');

config = require('./config');


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
 * - `nc`
 *
 * Resin Sync **doesn't support Windows yet**, however it will work
 * under Cygwin.
 *
 * You can save all the options mentioned below in a `resin-sync.yml`
 * file, by using the same option names as keys. For example:
 *
 * 	$ cat $PWD/resin-sync.yml
 * 	source: src/
 * 	before: 'echo Hello'
 * 	exec: 'python main.py'
 * 	ignore:
 * 		- .git
 * 		- node_modules/
 * 	progress: true
 *
 * Notice that explicitly passed command options override the ones
 * set in the configuration file.
 *
 * @param {String} uuid - device uuid
 * @param {Object} [options] - options
 * @param {String} [options.source=$PWD] - source path
 * @param {String[]} [options.ignore] - ignore paths
 * @param {String} [options.before] - command to execute before sync
 * @param {String} [options.exec] - command to execute after sync (on the device)
 * @param {Boolean} [options.progress=true] - display sync progress
 * @param {Number} [options.port=80] - ssh port
 *
 * @example
 * resinSync.sync('7a4e3dc', {
 *   ignore: [ '.git', 'node_modules' ],
 *   progress: false
 * });
 */

exports.sync = function(uuid, options) {
  var performSync;
  options = _.merge(config.load(), options);
  _.defaults(options, {
    source: process.cwd()
  });
  utils.validateObject(options, {
    properties: {
      ignore: {
        description: 'ignore',
        type: 'array',
        message: 'The ignore option should be an array'
      },
      before: {
        description: 'before',
        type: 'string',
        message: 'The before option should be a string'
      },
      exec: {
        description: 'exec',
        type: 'string',
        message: 'The exec option should be a string'
      },
      progress: {
        description: 'progress',
        type: 'boolean',
        message: 'The progress option should be a boolean'
      }
    }
  });
  console.info("Connecting with: " + uuid);
  performSync = function(fullUUID) {
    return Promise["try"](function() {
      if (options.before != null) {
        return shell.runCommand(options.before);
      }
    }).then(function() {
      var command;
      command = rsync.getCommand(fullUUID, options);
      return shell.runCommand(command);
    }).then(function() {
      var command;
      if (options.exec != null) {
        console.info('Synced, running command');
        command = ssh.getConnectCommand({
          uuid: fullUUID,
          command: options.exec,
          port: options.port
        });
        return shell.runCommand(command);
      } else {
        console.info('Synced, restarting device');
        return resin.models.device.restart(uuid);
      }
    });
  };
  return resin.models.device.isOnline(uuid).tap(function(isOnline) {
    if (!isOnline) {
      throw new Error('Device is not online');
    }
  }).then(function() {
    return resin.models.device.get(uuid).get('uuid').then(performSync);
  });
};
