
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
var path, revalidator, rsync, ssh, utils, _;

_ = require('lodash');

_.str = require('underscore.string');

revalidator = require('revalidator');

path = require('path');

rsync = require('rsync');

utils = require('./utils');

ssh = require('./ssh');


/**
 * @summary Get rsync command
 * @function
 * @protected
 *
 * @param {String} uuid - uuid
 * @param {Object} options - rsync options
 * @param {String} options.source - source path
 * @param {Boolean} [options.progress] - show progress
 * @param {String|String[]} [options.ignore] - pattern/s to ignore
 *
 * @returns {String} rsync command
 *
 * @example
 * command = rsync.getCommand '...',
 * 	source: 'foo/bar'
 * 	uuid: '1234567890'
 */

exports.getCommand = function(uuid, options) {
  var args, result;
  if (options == null) {
    options = {};
  }
  utils.validateObject(options, {
    properties: {
      source: {
        description: 'source',
        type: 'string',
        required: true,
        messages: {
          type: 'Not a string: source',
          required: 'Missing source'
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
  if (!_.str.isBlank(options.source) && _.last(options.source) !== '/') {
    options.source += '/';
  }
  args = {
    source: options.source,
    destination: "root@" + uuid + ".resin:/data/.resin-watch",
    progress: options.progress,
    shell: ssh.getConnectCommand(options),
    flags: 'azr'
  };
  if (_.isEmpty(options.source.trim())) {
    args.source = '.';
  }
  if (options.ignore != null) {
    args.exclude = options.ignore;
  }
  result = rsync.build(args).command();
  result = result.replace(/\\\\/g, '\\');
  return result;
};
