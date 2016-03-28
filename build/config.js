
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
var fs, jsYaml, path, _;

fs = require('fs');

_ = require('lodash');

path = require('path');

jsYaml = require('js-yaml');


/**
 * @summary Get config path
 * @function
 * @private
 *
 * @returns {String} config path
 *
 * @example
 * configPath = config.getPath()
 */

exports.getPath = function() {
  return path.join(process.cwd(), 'resin-sync.yml');
};


/**
 * @summary Load configuration file
 * @function
 * @protected
 *
 * @description
 * If no configuration file is found, return an empty object.
 *
 * @returns {Object} configuration
 *
 * @example
 * options = config.load()
 */

exports.load = function() {
  var config, configPath, error, result;
  configPath = exports.getPath();
  try {
    config = fs.readFileSync(configPath, {
      encoding: 'utf8'
    });
    result = jsYaml.safeLoad(config);
  } catch (_error) {
    error = _error;
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
  if (!_.isPlainObject(result)) {
    throw new Error("Invalid configuration file: " + configPath);
  }
  return result;
};
