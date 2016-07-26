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
form = require('resin-cli-form')
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
# @summary Load, validate and save passed options to '.resin-sync.yml'
# @function
# @private
#
# @param {String} uuid
# @param {String} cliOptions - cli options passed by the user
# @returns {Promise} options - the options to use for this resin sync run
#
###
exports.prepareOptions = prepareOptions = Promise.method (uuid, cliOptions) ->
	utils.validateObject cliOptions,
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

	options = _.mergeWith config.load(cliOptions.source), cliOptions, { uuid }, (objVal, srcVal) ->
		# Give precedence to command line 'ignore' options
		if _.isArray(objVal)
			return srcVal

	form.run [
		message: 'Destination directory on device [\'/usr/src/app\']'
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
		if options.ignore.length is 0 and not config.load(options.source).ignore?
			options.ignore = [ '.git', 'node_modules/' ]

		# Save new cli options. Omit 'source' (not required) as well as 'progress' and 'verbose'
		config.save(_.omit(options, [ 'source', 'progress', 'verbose' ]), options.source)

		return options

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
# resinSync.sync('7a4e3dc', {
#		source: '.',
#		destination: '/usr/src/app',
#   ignore: [ '.git', 'node_modules' ],
#   progress: false
# });
###
exports.sync = (uuid, cliOptions) ->

	syncOptions = {}

	# Each sync step is enclosed in a separate Promise
	getDeviceInfo = ->
		{ uuid } = syncOptions

		console.info("Getting information for device: #{uuid}")

		resin.models.device.isOnline(uuid).then (isOnline) ->
			throw new Error('Device is not online') if not isOnline
			resin.models.device.get(uuid)
		.tap (device) ->
			ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
		.then (device) ->
			Promise.props
				uuid: device.uuid	# get full uuid
				username: resin.auth.whoami()
			.then(_.partial(_.merge, syncOptions))

	clearSpinner = (spinner, msg) ->
		spinner.stop() if spinner?
		console.log(msg) if msg?

	spinnerPromise = (promise, startMsg, stopMsg) ->
		spinner = new Spinner(startMsg)
		spinner.start()
		promise.then (value) ->
			clearSpinner(spinner, stopMsg)
			return value
		.catch (err) ->
			clearSpinner(spinner)
			throw err

	beforeAction = ->
		Promise.try ->
			shell.runCommand(syncOptions.before, cwd: syncOptions.source) if syncOptions.before?

	afterAction = ->
		Promise.try ->
			shell.runCommand(syncOptions.after, cwd: syncOptions.source) if syncOptions.after?

	stopContainer = ->
		{ uuid } = syncOptions

		spinnerPromise(
			resin.models.device.stopApplication(uuid)
			'Stopping application container...'
			'Application container stopped.'
		).then (containerId) ->
			_.merge(syncOptions, { containerId })

	syncContainer = Promise.method ->
		{ uuid, containerId, source, destination } = syncOptions

		if not containerId?
			throw new Error('No stopped application container found')

		command = rsync.getCommand(syncOptions)

		spinnerPromise(
			shell.runCommand(command, cwd: source)
			"Syncing to #{destination} on #{uuid.substring(0, 7)}..."
			"Synced #{destination} on #{uuid.substring(0, 7)}."
		)

	startContainer = ->
		{ uuid } = syncOptions

		spinnerPromise(
			resin.models.device.startApplication(uuid)
			'Application container started.'
			'Starting application container...'
		)

	startContainerAfterError = ->
		{ uuid } = syncOptions

		spinnerPromise(
			resin.models.device.startApplication(uuid)
			'Attempting to restart stopped application container after failed \'resin sync\'...'
			'Application container restarted after failed \'resin sync\'.'
		)

	prepareOptions(uuid, cliOptions)
	.then(_.partial(_.merge, syncOptions))
	.then(getDeviceInfo)
	.then(beforeAction)
	.then(stopContainer)
	.then ->
		syncContainer()
		.then(startContainer)
		.then(afterAction)
		.then ->
			console.log(chalk.green.bold('\nresin sync completed successfully!'))
		.catch (err) ->
			# Notify the user of the error and run 'startApplication()'
			# once again to make sure that a new app container will be started
			startContainerAfterError()
			.catch (err) ->
				console.log('Could not restart application container', err)
			.finally ->
				throw err
	.catch (err) ->
		console.log(chalk.red.bold('resin sync failed.', err))
		process.exit(1)
