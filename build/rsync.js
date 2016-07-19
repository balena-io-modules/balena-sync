
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
var rsync, settings, ssh, utils, _;

_ = require('lodash');

_.str = require('underscore.string');

rsync = require('rsync');

settings = require('resin-settings-client');

utils = require('./utils');

ssh = require('./ssh');


/**
 * @summary Get rsync command
 * @function
 * @protected
 *
 * @param {Object} options - rsync options
 * @param {String} options.username - username
 * @param {String} options.uuid - device uuid
 * @param {String} options.containerId - container id
 * @param {String} options.destination - destination directory on device
 * @param {Boolean} [options.progress] - show progress
 * @param {String|String[]} [options.ignore] - pattern/s to ignore
 * @param {Number} [options.port=22] - ssh port
 *
 * @returns {String} rsync command
 *
 * @example
 * command = rsync.getCommand
 *		username: 'test',
 *		uuid: '1324'
 *		containerId: '6789'
 */

exports.getCommand = function(options) {
  var args, result, username;
  if (options == null) {
    options = {};
  }
  utils.validateObject(options, {
    properties: {
      username: {
        description: 'username',
        type: 'string',
        required: true,
        messages: {
          type: 'Not a string: username',
          required: 'Missing username'
        }
      },
      progress: {
        description: 'progress',
        type: 'boolean',
        message: 'Not a boolean: progress'
      },
      ignore: {
        description: 'ignore',
        type: ['string', 'array'],
        message: 'Not a string or array: ignore'
      },
      verbose: {
        description: 'verbose',
        type: 'boolean',
        message: 'Not a boolean: verbose'
      },
      destination: {
        description: 'destination',
        type: 'any',
        required: true,
        message: 'Not a string: destination'
      }
    }
  });
  username = options.username;
  args = {
    source: '.',
    destination: "" + username + "@ssh." + (settings.get('proxyUrl')) + ":" + options.destination,
    progress: options.progress,
    shell: ssh.getConnectCommand(options),
    flags: {
      'a': true,
      'z': true,
      'v': options.verbose
    }
  };
  if (options.ignore != null) {
    args.exclude = options.ignore;
  }
  result = rsync.build(args).set('delete-excluded').command();
  result = result.replace(/\\\\/g, '\\');
  if (options.verbose) {
    console.log("resin sync command: " + result);
  }
  return result;
};
