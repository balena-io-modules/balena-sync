###
Copyright 2016 Balena

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

###*
# Helper methods to manipulate the balena push/sync configuration file (currently .balena-sync.yml)
# @module build-trigger
###
#
fs = require('fs')
_ = require('lodash')
path = require('path')
jsYaml = require('js-yaml')
{ fileExists } = require('./utils')

exports.CONFIG_FILE = CONFIG_FILE = '.balena-sync.yml'
exports.LEGACY_CONFIG_FILE = LEGACY_CONFIG_FILE = '.resin-sync.yml'

###*
# @summary Get config path
# @function
# @private
#
# @param {String} [baseDir=process.cwd()]
# @param {String} [configFile=CONFIG_FILE]
#
# @returns {String} config path
#
# @example
# configPath = config.getPath('.')
###
exports.getPath = (baseDir = process.cwd(), configFile = CONFIG_FILE) ->
	return path.join(baseDir, configFile)

###*
# @summary Load configuration file
# @function
# @protected
#
# @description
# If no configuration file is found, return an empty object.
#
# @param {String} [baseDir=process.cwd()]
# @param {String} [configFile=CONFIG_FILE]
#
# @returns {Object} YAML configuration as object
# @throws Exception on error
#
# @example
# options = config.load('.')
###
exports.load = (baseDir = process.cwd(), configFile = CONFIG_FILE) ->
	configPath = exports.getPath(baseDir, configFile)

	# fileExists() will throw on any error other than 'ENOENT' (file not found)
	if not fileExists(configPath)
		if configFile == CONFIG_FILE
			# Ensure config loading falls back to the legacy config file
			return exports.load(baseDir, LEGACY_CONFIG_FILE)
		return {}

	config = fs.readFileSync(configPath, encoding: 'utf8')
	result = jsYaml.safeLoad(config)

	if not _.isPlainObject(result)
		throw new Error("Invalid configuration file: #{configPath}")

	if config['local_resinos']
		config['local_balenaos'] = config['local_resinos']
		delete config['local_resinos']

	return result
#
###*
# @summary Serializes object as yaml object and saves it to file
# @function
# @protected
#
# @param {String} yamlObj - YAML object to save
# @param {String} [baseDir=process.cwd()]
# @param {String} [configFile=CONFIG_FILE]
#
# @throws Exception on error
# @example
# config.save(yamlObj)
###
exports.save = (yamlObj, baseDir = process.cwd(), configFile = CONFIG_FILE) ->
	configSavePath = exports.getPath(baseDir, configFile)

	yamlDump = jsYaml.safeDump(yamlObj)
	fs.writeFileSync(configSavePath, yamlDump, encoding: 'utf8')
