
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
 * @param {String} baseDir
 *
 * @returns {String} config path
 *
 * @example
 * configPath = config.getPath('.')
 */

exports.getPath = function(baseDir) {
  if (baseDir == null) {
    baseDir = process.cwd();
  }
  return path.join(baseDir, '.resin-sync.yml');
};


/**
 * @summary Load configuration file
 * @function
 * @protected
 *
 * @description
 * If no configuration file is found, return an empty object.
 *
 * @param {String} baseDir
 *
 * @returns {Object} configuration
 *
 * @example
 * options = config.load('.')
 */

exports.load = function(baseDir) {
  var config, configPath, error, result;
  configPath = exports.getPath(baseDir);
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


/**
 * @summary Serialezed object as yaml object and saves it to file
 * @function
 * @protected
 *
 * @param {String} yamlObj
 * @param {String} baseDir
 *
 * @throws Exception on error
 * @example
 * options = config.save(yamlObj, '.')
 */

exports.save = function(yamlObj, baseDir) {
  var configSavePath, error, yamlDump;
  if (yamlObj == null) {
    yamlObj = {};
  }
  configSavePath = exports.getPath(baseDir);
  try {
    yamlDump = jsYaml.safeDump(yamlObj);
    return fs.writeFileSync(configSavePath, yamlDump, {
      encoding: 'utf8'
    });
  } catch (_error) {
    error = _error;
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};
