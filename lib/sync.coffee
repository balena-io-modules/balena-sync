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
chalk = require('chalk')
resin = require('resin-sdk')
Spinner = require('resin-cli-visuals').Spinner
rsync = require('./rsync')
utils = require('./utils')
shell = require('./shell')
config = require('./config')
semver = require('semver')

MIN_HOSTOS_RSYNC = '1.1.4'

# Extract semver from device.os_version, since its format
# can be in a form similar to 'Resin OS 1.1.0 (fido)'
semverRegExp = /[0-9]+\.[0-9]+\.[0-9]+(?:(-|\+)[^\s]+)?/

###*
# @summary Ensure HostOS compatibility
# @function
# @private
#
# @description
# Ensures 'rsync' is installed on the target device by checking
# HostOS version. Fullfills promise if device is compatible or
# rejects it otherwise. Version checks are based on semver.
#
# @param {String} osRelease - HostOS version as returned from the API (device.os_release field)
# @param {String} minVersion - Minimum accepted HostOS version
# @returns {Promise}
#
# @example
# ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
# .then ->
#		console.log('Is compatible')
# .catch ->
#		console.log('Is incompatible')
###
exports.ensureHostOSCompatibility = ensureHostOSCompatibility = Promise.method (osRelease, minVersion) ->
	version = osRelease?.match(semverRegExp)?[0]
	if not version?
		throw new Error("Could not parse semantic version from HostOS release info: #{osRelease}")

	if semver.lt(version, minVersion)
		throw new Error("Incompatible HostOS version: #{osRelease} - must be >= #{minVersion}")

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
# You can save all the options mentioned below in a `resin-sync.yml`
# file, by using the same option names as keys. For example:
#
# 	$ cat $PWD/resin-sync.yml
# 	source: src/
# 	before: 'echo Hello'
# 	ignore:
# 		- .git
# 		- node_modules/
# 	progress: false
#
# Notice that explicitly passed command options override the ones
# set in the configuration file.
#
# @param {String} uuid - device uuid
# @param {Object} [options] - options
# @param {String} [options.source=$PWD] - source path
# @param {String[]} [options.ignore] - ignore paths
# @param {String} [options.before] - command to execute before sync
# @param {Boolean} [options.progress] - display rsync progress
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
			before:
				description: 'before'
				type: 'string'
				message: 'The before option should be a string'

	console.info("Connecting with: #{uuid}")

	resin.models.device.isOnline(uuid).then (isOnline) ->
		throw new Error('Device is not online') if not isOnline
		resin.models.device.get(uuid)
	.tap (device) ->
		ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
	.tap (device) ->
		Promise.try ->
			shell.runCommand(options.before, cwd: options.source) if options.before?
	.then (device) ->
		Promise.props
			uuid: device.uuid	# get full uuid
			username: resin.auth.whoami()
	.then ({ uuid, username }) ->
		spinner = new Spinner('Stopping application container...')
		spinner.start()

		resin.models.device.stopApplication(uuid)
		.then (containerId) ->
			spinner.stop()
			console.log('Application container stopped.')

			if not containerId?
				throw new Error('No stopped application container found')

			spinner = new Spinner("Syncing to /usr/src/app on #{uuid.substring(0, 7)}...")
			spinner.start()

			options = _.merge(options, { username, uuid, containerId })
			command = rsync.getCommand(options)
			shell.runCommand(command, cwd: options.source)
			.then ->
				spinner.stop()
				console.log("Synced /usr/src/app on #{uuid.substring(0, 7)}.")

				spinner = new Spinner('Starting application container...')
				spinner.start()

				resin.models.device.startApplication(uuid)
			.then ->
				spinner.stop()
				console.log('Application container started.')
				console.log(chalk.green.bold('\nresin sync completed successfully!'))
			.catch (err) ->
				# TODO: Supervisor completely removes a stopped container that
				# fails to start, so notify the user and run 'startApplication()'
				# once again to make sure that a new app container will be started
				spinner.stop()
				console.log('resin sync failed', err)
				resin.models.device.startApplication(uuid)
				.catch (err) ->
					console.log('Could not restart application container', err)
		.catch (err) ->
			spinner.stop()
			console.log('resin sync failed', err)
