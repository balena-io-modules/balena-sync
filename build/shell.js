
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
var child_process, os, rindle, _;

child_process = require('child_process');

_ = require('lodash');

os = require('os');

rindle = require('rindle');


/**
 * @summary Get sub shell command
 * @function
 * @protected
 *
 * @param {String} command - command
 * @returns {String} sub shell command
 *
 * @example
 * subShellCommand = shell.getSubShellCommand('foo')
 */

exports.getSubShellCommand = function(command) {
  if (os.platform() === 'win32') {
    return {
      program: 'cmd.exe',
      args: ['/s', '/c', command]
    };
  } else {
    return {
      program: '/bin/sh',
      args: ['-c', command]
    };
  }
};


/**
 * @summary Run a command in a subshell
 * @function
 * @protected
 *
 * @description
 * stdin is inherited from the parent process.
 *
 * @param {String} command - command
 * @param {Object} [options] - options
 * @param {String} [options.cwd] - current working directory
 * @returns {Promise}
 *
 * @example
 * shell.runCommand('echo hello').then ->
 * 	console.log('Done!')
 */

exports.runCommand = function(command, options) {
  var env, homedrive, homepath, spawn, subShellCommand;
  if (options == null) {
    options = {};
  }
  env = {};
  if (os.platform() === 'win32') {
    homedrive = _.get(process, 'env.homedrive', 'C:').slice(0, 1).toLowerCase();
    homepath = _.get(process, 'env.homepath', '').replace(/\\/g, '/');
    env.HOME = "/" + homedrive + homepath;
  }
  subShellCommand = exports.getSubShellCommand(command);
  spawn = child_process.spawn(subShellCommand.program, subShellCommand.args, {
    stdio: 'inherit',
    env: _.merge(env, process.env),
    cwd: options.cwd,
    windowsVerbatimArguments: true
  });
  return rindle.wait(spawn).spread(function(code) {
    if (code === 0) {
      return;
    }
    throw new Error("Child process exited with code " + code);
  });
};
