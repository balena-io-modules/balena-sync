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
resin = require('resin-sdk')
form = require('resin-cli-form')
settings = require('resin-settings-client')
shell = require('../shell')
config = require('../config')
{ buildRsyncCommand } = require('../rsync')
{ validateObject
	spinnerPromise
	startContainer
	stopContainer
	startContainerAfterError
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

# Resolves with array of online devices, throws on error
exports.discoverOnlineDevices = ->
	resin.models.device.getAll()
	.filter (device) ->
		device.is_online

###*
# @summary Prepare and validate options from command line and `.resin-sync.yml` (if found)
# @function
# @private
#
# @param {String} uuid
# @param {String} cliOptions - cli options passed by the user
# @returns {Promise} options - the options to use for this resin sync run
#
###
prepareOptions = Promise.method (uuid, cliOptions) ->

	validateObject cliOptions,
		properties:
			source:
				description: 'source'
				type: 'any'
				required: true
				message: 'The source option should be a string'
			before:
				description: 'before'
				type: 'string'
				message: 'The before option should be a string'
			after:
				description: 'after'
				type: 'string'
				message: 'The after option should be a string'

	Promise.try ->
		configFileOptions = config.load(cliOptions.source)

		return configFileOptions if not _.isEmpty(configFileOptions)

		# If `.resin-sync.yml` is not found, look for a backwards-compatible `resin-sync.yml` and prompt the user
		# for confirmation to convert it to `.resin-sync.yml`. This is to make a smoother transition
		# from older resin sync versions, where `resin-sync.yml` was used. The original
		# `resin-sync.yml` will not be deleted.
		try
			@oldConfigFileOptions = config.load(cliOptions.source, 'resin-sync.yml')
			return {} if _.isEmpty(@oldConfigFileOptions)
		catch
			return {}

		form.ask
			message: '''
				A \'resin-sync.yml\' configuration file was found, but the current resin-cli version expects a \'.resin-sync.yml\' file instead.
				Convert \'resin-sync.yml\' to \'.resin-sync.yml\' (the original file will be kept either way) ?
			'''
			type: 'list'
			choices: [ 'Yes', 'No' ]
		.then (answer) ->
			if answer is 'No'
				return {}
			else
				saveOptions(@oldConfigFileOptions, cliOptions.source, '.resin-sync.yml')
				return config.load(cliOptions.source)
	.then	(loadedOptions) ->
		options = {}

		_.mergeWith options, loadedOptions, cliOptions, { uuid }, (objVal, srcVal) ->
			# Give precedence to command line 'ignore' options
			if _.isArray(objVal)
				return srcVal

		form.run [
			message: 'Destination directory on device [/usr/src/app]'
			name: 'destination'
			type: 'input'
		],
			override:
				destination: options.destination
		.get('destination')
		.then (dest) ->

			# Set default options
			_.defaults options,
				destination: dest ? '/usr/src/app'
				port: 22

			# Filter out empty 'ignore' paths
			options.ignore = _.filter(options.ignore, (item) -> not _.isEmpty(item))

			# Only add default 'ignore' options if user has not explicitly set an empty
			# 'ignore' setting in '.resin-sync.yml'
			if options.ignore.length is 0 and not loadedOptions.ignore?
				options.ignore = [ '.git', 'node_modules/' ]

			return options

###*
# @summary Save passed options to '.resin-sync.yml' in 'source' folder
# @function
# @private
#
# @param {String} options - options to save to `.resin-sync.yml`
# @returns {Promise} - Promise is rejected if file could not be saved
#
###
saveOptions = Promise.method (options, baseDir, configFile) ->

	config.save(
		_.pick(
			options
			[ 'uuid', 'destination', 'port', 'before', 'after', 'ignore', 'skip-gitignore' ]
		)
		baseDir ? options.source
		configFile ? '.resin-sync.yml'
	)

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
# @param {String} uuid - device uuid
# @param {Object} [cliOptions] - cli options
# @param {String[]} [cliOptions.source] - source directory on local host
# @param {String[]} [cliOptions.destination=/usr/src/app] - destination directory on device
# @param {String[]} [cliOptions.ignore] - ignore paths
# @param {String[]} [cliOptions.skip-gitignore] - skip .gitignore when parsing exclude/include files
# @param {String} [cliOptions.before] - command to execute before sync
# @param {String} [cliOptions.after] - command to execute after sync
# @param {Boolean} [cliOptions.progress] - display rsync progress
# @param {Number} [cliOptions.port=22] - ssh port
#
# @example
# resinSync('7a4e3dc', {
#		source: '.',
#		destination: '/usr/src/app',
#   ignore: [ '.git', 'node_modules' ],
#   progress: false
# });
###
exports.sync = (uuid, cliOptions) ->

	syncOptions = {}

	getDeviceInfo = ->
		{ uuid } = syncOptions

		console.info("Getting information for device: #{uuid}")

		resin.models.device.isOnline(uuid).then (isOnline) ->
			throw new Error('Device is not online') if not isOnline
			resin.models.device.get(uuid)
		.tap (device) ->
			# Ensure user is the owner of the device. This is also checked on the backend side.
			resin.auth.getUserId().then (userId) ->
				if userId isnt device.user.__id
					throw new Error('Resin sync is permitted to the device owner only. The device owner is the user who provisioned it.')
		.tap (device) ->
			ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
		.then (device) ->
			Promise.props
				uuid: device.uuid	# get full uuid
				username: resin.auth.whoami()
			.then(_.partial(_.merge, syncOptions))

	syncContainer = Promise.method ->
		{ uuid, containerId, source, destination } = syncOptions

		if not containerId?
			throw new Error('No stopped application container found')

		command = buildRsyncCommand _.assign syncOptions,
			host: "ssh.#{settings.get('proxyUrl')}"
			'remote-cmd': "rsync #{uuid} #{containerId}"

		spinnerPromise(
			shell.runCommand(command, cwd: source)
			"Syncing to #{destination} on #{uuid.substring(0, 7)}..."
			"Synced #{destination} on #{uuid.substring(0, 7)}."
		)

	prepareOptions(uuid, cliOptions)
	.then(_.partial(_.merge, syncOptions))
	.then(getDeviceInfo)
	.then ->
		saveOptions(syncOptions)
	.then -> # run 'before' action
		if syncOptions.before?
			shell.runCommand(syncOptions.before, syncOptions.source)
	.then -> # stop container
		stopContainer(resin.models.device.stopApplication(uuid)).then (containerId) ->
			# the resolved 'containerId' value is needed for the rsync process over resin-proxy
			_.merge(syncOptions, { containerId })
	.then -> # sync container
		syncContainer()
		.then -> # start container
			startContainer(resin.models.device.startApplication(uuid))
		.then -> # run 'after' action
			if syncOptions.after?
				shell.runCommand(syncOptions.after, syncOptions.source)
		.then ->
			console.log(chalk.green.bold('\nresin sync completed successfully!'))
		.catch (err) ->
			# Notify the user of the error and run 'startApplication()'
			# once again to make sure that a new app container will be started
			startContainerAfterError(resin.models.device.startApplication(uuid))
			.catch (err) ->
				console.log('Could not start application container', err)
			.finally ->
				throw err
	.catch (err) ->
		console.log(chalk.red.bold('resin sync failed.', err))
		process.exit(1)
