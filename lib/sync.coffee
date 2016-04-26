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

###*
# @module resinSync
###

Promise = require('bluebird')
_ = require('lodash')
resin = require('resin-sdk')
rsync = require('./rsync')
utils = require('./utils')
shell = require('./shell')
ssh = require('./ssh')
config = require('./config')

###*
# @summary Sync your changes with a device
# @function
# @public
#
# @description
# This module provides a way to sync changes from a local source
# directory to a device. It relies on the following dependencies
# being installed in the system:
#
# - `rsync`
# - `ssh`
#
# Resin Sync **doesn't support Windows yet**, however it will work
# under Cygwin.
#
# You can save all the options mentioned below in a `resin-sync.yml`
# file, by using the same option names as keys. For example:
#
# 	$ cat $PWD/resin-sync.yml
# 	source: src/
# 	before: 'echo Hello'
# 	ignore:
# 		- .git
# 		- node_modules/
# 	progress: true
#
# Notice that explicitly passed command options override the ones
# set in the configuration file.
#
# @param {String} uuid - device uuid
# @param {Object} [options] - options
# @param {String} [options.source=$PWD] - source path
# @param {String[]} [options.ignore] - ignore paths
# @param {String} [options.before] - command to execute before sync
# @param {Boolean} [options.progress=true] - display sync progress
# @param {Number} [options.port=22] - ssh port
#
# @example
# resinSync.sync('7a4e3dc', {
#   ignore: [ '.git', 'node_modules' ],
#   progress: false
# });
###
exports.sync = (uuid, options) ->
	options = _.merge(config.load(), options)

	_.defaults options,
		source: process.cwd()
		port: 22

	utils.validateObject options,
		properties:
			ignore:
				description: 'ignore'
				type: 'array'
				message: 'The ignore option should be an array'
			before:
				description: 'before'
				type: 'string'
				message: 'The before option should be a string'
			progress:
				description: 'progress'
				type: 'boolean'
				message: 'The progress option should be a boolean'

	console.info("Connecting with: #{uuid}")

	resin.models.device.isOnline(uuid).tap (isOnline) ->
		throw new Error('Device is not online') if not isOnline
		Promise.try ->
			shell.runCommand(options.before) if options.before?
	.then ->
		Promise.props
			uuid: resin.models.device.get(uuid).get('uuid')	# get full uuid
			username: resin.auth.whoami()
	.then ({ uuid, username }) ->
		console.log('Stopping application container...')
		resin.models.device.stopApplication(uuid)
		.then (containerId) ->
			if not containerId?
				throw new Error('No stopped application container found')

			options = _.merge(options, { username, uuid, containerId })
			command = rsync.getCommand(options)
			shell.runCommand(command)
			.catch (err) ->
				console.log('rsync error: ', err)
		.tap ->
			console.log('Starting application container...')
			resin.models.device.startApplication(uuid)
		.catch (err) ->
			# TODO: Supervisor completely removes a stopped container that
			# fails to start, so notify the user and run 'startApplication()'
			# once again to make sure that a new app container will be started
			console.log('Rsync failed: application container could not be restarted', err)
			resin.models.device.startApplication(uuid)
