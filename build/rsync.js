
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
var path, revalidator, rsync, settings, ssh, utils, _;

_ = require('lodash');

_.str = require('underscore.string');

revalidator = require('revalidator');

path = require('path');

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
  var args, containerId, port, result, username, uuid;
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
      uuid: {
        description: 'uuid',
        type: 'string',
        required: true,
        messages: {
          type: 'Not a string: uuid',
          required: 'Missing uuid'
        }
      },
      containerId: {
        description: 'containerId',
        type: 'string',
        required: true,
        messages: {
          type: 'Not a string: containerId',
          required: 'Missing containerId'
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
      }
    }
  });
  username = options.username, uuid = options.uuid, containerId = options.containerId, port = options.port;
  args = {
    source: '.',
    destination: "" + username + "@ssh." + (settings.get('proxyUrl')) + ":",
    progress: options.progress,
    shell: ssh.getConnectCommand({
      username: username,
      uuid: uuid,
      containerId: containerId,
      port: port
    }),
    flags: 'az'
  };
  if (options.ignore != null) {
    args.exclude = options.ignore;
  }
  result = rsync.build(args).command();
  result = result.replace(/\\\\/g, '\\');
  return result;
};
