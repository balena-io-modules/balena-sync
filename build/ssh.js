
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
var _;

_ = require('lodash');


/**
 * @summary Get SSH connection command for a device
 * @function
 * @protected
 *
 * @param {Object} [options] - options
 * @param {String} [options.uuid] - device uuid
 * @param {String} [options.command] - command to execute
 * @param {Number} [options.port] - ssh port
 *
 * @returns {String} ssh command
 *
 * @example
 * ssh.getConnectCommand
 * 	uuid: '1234'
 * 	command: 'date'
 */

exports.getConnectCommand = function(options) {
  var result;
  if (options == null) {
    options = {};
  }
  _.defaults(options, {
    port: 80
  });
  result = "ssh -p " + options.port + " -o \"ProxyCommand nc -X connect -x vpn.resin.io:3128 %h %p\" -o StrictHostKeyChecking=no";
  if (options.uuid != null) {
    result += " root@" + options.uuid + ".resin";
  }
  if (options.command != null) {
    result += " \"" + options.command + "\"";
  }
  return result;
};
