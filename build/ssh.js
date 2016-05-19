
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
var settings, utils, _;

_ = require('lodash');

settings = require('resin-settings-client');

utils = require('./utils');


/**
 * @summary Get SSH connection command for a device
 * @function
 * @protected
 *
 * @param {Object} [options] - options
 * @param {String} [options.username] - username
 * @param {String} [options.uuid] - device uuid
 * @param {String} [options.containerId] - container id
 * @param {Number} [options.port] - resin ssh gateway port
 *
 * @returns {String} ssh command
 *
 * @example
 * ssh.getConnectCommand
 *		username: 'test'
 * 	uuid: '1234'
 * 	containerId: '4567'
 * 	command: 'date'
 */

exports.getConnectCommand = function(options) {
  var containerId, port, result, username, uuid;
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
      }
    }
  });
  _.defaults(options, {
    port: 22
  });
  username = options.username, uuid = options.uuid, containerId = options.containerId, port = options.port;
  result = "ssh -p " + port + " -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null " + username + "@ssh." + (settings.get('proxyUrl')) + " rsync " + uuid + " " + containerId;
  return result;
};
