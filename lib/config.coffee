###
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
###

fs = require('fs')
_ = require('lodash')
path = require('path')
jsYaml = require('js-yaml')

###*
# @summary Get config path
# @function
# @private
#
# @param {String} baseDir
#
# @returns {String} config path
#
# @example
# configPath = config.getPath('.')
###
exports.getPath = (baseDir = process.cwd(), configFile = '.resin-sync.yml') ->
	return path.join(baseDir, configFile)

###*
# @summary Load configuration file
# @function
# @protected
#
# @description
# If no configuration file is found, return an empty object.
#
# @param {String} baseDir
#
# @returns {Object} configuration
#
# @example
# options = config.load('.')
###
exports.load = (baseDir, configFile = '.resin-sync.yml') ->
	configPath = exports.getPath(baseDir, configFile)

	try
		config = fs.readFileSync(configPath, encoding: 'utf8')
		result = jsYaml.safeLoad(config)

		if not _.isPlainObject(result)
			throw new Error("Invalid configuration file: #{configPath}")
	catch error
		if error.code is 'ENOENT'
			return {}
		throw error

	return result
#
###*
# @summary Serializes object as yaml object and saves it to file
# @function
# @protected
#
# @param {String} yamlObj
# @param {String} baseDir
#
# @throws Exception on error
# @example
# options = config.save(yamlObj, '.')
###
exports.save = (yamlObj = {}, baseDir, configFile = '.resin-sync.yml') ->
	configSavePath = exports.getPath(baseDir, configFile)

	try
		yamlDump = jsYaml.safeDump(yamlObj)
		fs.writeFileSync(configSavePath, yamlDump, encoding: 'utf8')
	catch error
		if error.code is 'ENOENT'
			return {}
		throw error
