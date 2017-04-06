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
semver = require('semver')
resin = require('resin-sdk-preconfigured')
settings = require('resin-settings-client')
shell = require('../shell')
{ SpinnerPromise } = require('resin-cli-visuals')
{ buildRsyncCommand } = require('../rsync')
{	stopContainerSpinner
	startContainerSpinner
	infoContainerSpinner
	startContainerAfterErrorSpinner
} = require('../utils')

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
ensureHostOSCompatibility = Promise.method (osRelease, minVersion) ->
	version = osRelease?.match(semverRegExp)?[0]
	if not version?
		throw new Error("Could not parse semantic version from HostOS release info: #{osRelease}")

	if semver.lt(version, minVersion)
		throw new Error("Incompatible HostOS version: #{osRelease} - must be >= #{minVersion}")

# Resolves with uuid, throws on error or if device is offline
exports.ensureDeviceIsOnline = (uuid) ->
	resin.models.device.get(uuid)
	.then (device) ->
		if not device.is_online
			throw new Error("Device is offline: #{uuid}")
		return uuid

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
# 	destination: '/usr/src/app/'
# 	before: 'echo Hello'
# 	after: 'echo Done'
# 	port: 22
# 	ignore:
# 		- .git
# 		- node_modules/
#
# Notice that explicitly passed command options override the ones
# set in the configuration file.
#
# @param {Object} [syncOptions] - cli options
# @param {String} [syncOptions.uuid] - device uuid
# @param {String} [syncOptions.baseDir] - project base dir
# @param {String} [syncOptions.destination=/usr/src/app] - destination directory on device
# @param {String} [syncOptions.before] - command to execute before sync
# @param {String} [syncOptions.after] - command to execute after sync
# @param {String[]} [syncOptions.ignore] - ignore paths
# @param {Number} [syncOptions.port=22] - ssh port
# @param {Boolean} [syncOptions.skipGitignore=false] - skip .gitignore when parsing exclude/include files
# @param {Boolean} [syncOptions.skipRestart=false] - do not restart container after sync
# @param {Boolean} [syncOptions.progress=false] - display rsync progress
# @param {Boolean} [syncOptions.verbose=false] - display verbose info
#
# @example
# sync({
#		uuid: '7a4e3dc',
#		baseDir: '.',
#		destination: '/usr/src/app',
#   ignore: [ '.git', 'node_modules' ],
#   progress: false
# });
###
exports.sync = ({ uuid, baseDir, destination, before, after, ignore, port = 22, skipGitignore = false, skipRestart = false, progress = false, verbose = false } = {}) ->

	throw new Error("'destination' is a required sync option") if not destination?
	throw new Error("'uuid' is a required sync option") if not uuid?

	# Resolves with object with required device info or is rejected if API was not accessible. Resolved object:
	#
	#	{
	#		fullUuid: <string, full resin.io device UUID>
	#	}
	#
	getDeviceInfo = (uuid) ->
		RequiredDeviceObjectFields = [ 'uuid', 'os_version' ]

		# Returns a promise that is resolved with the API-fetched device object or rejected on error or missing requirement
		ensureDeviceRequirements = (device) ->
			# Ensure user is the owner of the device. This is also checked on the backend side.
			resin.auth.getUserId()
			.then (userId) ->
				if userId isnt device.user.__id
					throw new Error('Resin sync is permitted to the device owner only. The device owner is the user who provisioned it.')
			.then -> # Ensure minimum required HostOS version for resin sync
				ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
			.then ->
				missingKeys = _.difference(RequiredDeviceObjectFields, _.keys(device))
				if missingKeys.length > 0
					throw new Error("Fetched device info is missing required fields '#{missingKeys.join("', '")}'")

				return device

		console.info("Getting information for device: #{uuid}")

		resin.models.device.isOnline(uuid).then (isOnline) ->
			throw new Error('Device is not online') if not isOnline
			resin.models.device.get(uuid)
		.then(ensureDeviceRequirements) # Fail early if 'resin sync'-specific requirements are not met
		.then ({ uuid }) ->
			return {
				fullUuid: uuid
			}

	syncContainer = Promise.method ({ fullUuid, username, containerId, baseDir = process.cwd(), destination }) ->
		if not containerId?
			throw new Error('No application container found')

		syncOptions =
			username: username
			host: "ssh.#{settings.get('proxyUrl')}"
			source: baseDir
			destination: destination
			ignore: ignore
			skipGitignore: skipGitignore
			verbose: verbose
			port: port
			progress: progress
			extraSshOptions: "#{username}@ssh.#{settings.get('proxyUrl')} rsync #{fullUuid} #{containerId}"

		command = buildRsyncCommand(syncOptions)

		new SpinnerPromise
			promise: shell.runCommand(command, cwd: baseDir)
			startMessage: "Syncing to #{destination} on #{fullUuid.substring(0, 7)}..."
			stopMessage: "Synced #{destination} on #{fullUuid.substring(0, 7)}."

	Promise.props(
		fullUuid: getDeviceInfo(uuid).get('fullUuid')
		username: resin.auth.whoami()
	)
	.tap -> # run 'before' action
		if before?
			shell.runCommand(before, baseDir)
	.then ({ fullUuid, username }) ->
		# the resolved 'containerId' value is needed for the rsync process over resin-proxy
		infoContainerSpinner(resin.models.device.getApplicationInfo(fullUuid))
		.then ({ containerId }) -> # sync container
			syncContainer({ fullUuid, username, containerId, baseDir, destination })
			.then ->
				if skipRestart is false
					# There is a `restartApplication()` sdk method that we can't use
					# at the moment, because it always removes the original container,
					# which results in `resin sync` changes getting lost.
					stopContainerSpinner(resin.models.device.stopApplication(fullUuid))
					.then ->
						startContainerSpinner(resin.models.device.startApplication(fullUuid))
			.then -> # run 'after' action
				if after?
					shell.runCommand(after, baseDir)
			.then ->
				console.log(chalk.green.bold('\nresin sync completed successfully!'))
			.catch (err) ->
				# Notify the user of the error and run 'startApplication()'
				# once again to make sure that a new app container will be started
				startContainerAfterErrorSpinner(resin.models.device.startApplication(fullUuid))
				.catch (err) ->
					console.log('Could not start application container', err)
				.throw(err)
	.catch (err) ->
		console.log(chalk.red.bold('resin sync failed.', err))
		throw err
