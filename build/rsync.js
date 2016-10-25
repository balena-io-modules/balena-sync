
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
var _, buildRshOption, path, rsync, utils;

path = require('path');

_ = require('lodash');

rsync = require('rsync');

utils = require('./utils');

buildRshOption = function(options) {
  var sshCommand, verbose;
  if (options == null) {
    options = {};
  }
  utils.validateObject(options, {
    properties: {
      host: {
        description: 'host',
        type: 'string',
        required: true
      },
      port: {
        description: 'port',
        type: 'number',
        required: true
      },
      verbose: {
        description: 'verbose',
        type: 'boolean'
      },
      extraSshOptions: {
        description: 'extraSshOptions',
        type: 'string'
      }
    }
  });
  verbose = options.verbose ? '-vv ' : '';
  sshCommand = "ssh " + verbose + "-p " + options.port + " -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlMaster=no";
  if (options.extraSshOptions != null) {
    sshCommand += " " + options.extraSshOptions;
  }
  return sshCommand;
};


/**
 * @summary Build rsync command
 * @function
 * @protected
 *
 * @param {Object} options - rsync options
 * @param {String} options.username - username
 * @param {String} options.host - host
 * @param {Boolean} [options.progress] - show progress
 * @param {String|String[]} [options.ignore] - pattern/s to ignore. Note that '.gitignore' is always used as a filter if it exists
 * @param {Boolean} [options.skipGitignore] - skip gitignore
 * @param {Boolean} [options.verbose] - verbose output
 * @param {String} options.source - source directory on local machine
 * @param {String} options.destination - destination directory on device
 * @param {String} options.rsyncPath - set --rsync-path rsync option
 *
 * @returns {String} rsync command
 *
 * @example
 * command = rsync.buildRsyncCommand
 *		host: 'ssh.resindevice.io'
 *		username: 'test'
 *		source: '/home/user/app',
 *		destination: '/usr/src/app'
 */

exports.buildRsyncCommand = function(options) {
  var args, gitignoreExclude, patterns, ref, result, rsyncCmd;
  if (options == null) {
    options = {};
  }
  utils.validateObject(options, {
    properties: {
      username: {
        description: 'username',
        type: 'string',
        required: true
      },
      host: {
        description: 'host',
        type: 'string',
        required: true,
        messages: {
          type: 'Not a string: host',
          required: 'Missing host'
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
      skipGitignore: {
        description: 'skip-gitignore',
        type: 'boolean',
        message: 'Not a boolean: skip-gitignore'
      },
      verbose: {
        description: 'verbose',
        type: 'boolean',
        message: 'Not a boolean: verbose'
      },
      source: {
        description: 'source',
        type: 'any',
        required: true,
        message: 'Not a string: source'
      },
      destination: {
        description: 'destination',
        type: 'any',
        required: true,
        message: 'Not a string: destination'
      },
      rsyncPath: {
        description: 'rsync path',
        type: 'string',
        message: 'Not a string: rsync-path'
      }
    }
  });
  args = {
    source: '.',
    destination: options.username + "@" + options.host + ":" + options.destination,
    progress: options.progress,
    shell: buildRshOption(options),
    flags: {
      'a': true,
      'z': true,
      'v': options.verbose
    }
  };
  rsyncCmd = rsync.build(args)["delete"]();
  if (options['rsyncPath'] != null) {
    rsyncCmd.set('rsync-path', options['rsyncPath']);
  }
  if (!options['skipGitignore']) {
    try {
      patterns = utils.gitignoreToRsyncPatterns(path.join(options.source, '.gitignore'));
      rsyncCmd.include(patterns.include);
      rsyncCmd.exclude(patterns.exclude);
    } catch (error) {}
  }
  if (options.ignore != null) {
    gitignoreExclude = (ref = patterns != null ? patterns.exclude : void 0) != null ? ref : [];
    rsyncCmd.exclude(_.difference(options.ignore, gitignoreExclude));
  }
  result = rsyncCmd.command();
  result = result.replace(/\\\\/g, '\\');
  if (options.verbose) {
    console.log("rsync command: " + result);
  }
  return result;
};
