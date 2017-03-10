Promise = require('bluebird')
_ = require('lodash')
Docker = require('docker-toolbelt')
form = require('resin-cli-form')
{ discoverLocalResinOsDevices } = require('./discover')
{ SpinnerPromise } = require('resin-cli-visuals')
{ dockerPort, dockerTimeout } = require('./config')

# Presents interactive dialog to choose an application name if no preferred application name
# is passed as a parameter.
#
# Resolves with selected application name if it is valid, throws otherwise
exports.selectAppName = (preferredAppName) ->
	# Helper function that Resolves with passed 'appName' if it's valid or throws otherwise
	validateAppName = Promise.method (appName) ->
		validCharsRegExp = new RegExp('^[a-z0-9-]+$')

		if _.isEmpty(appName)
			throw new Error('Application name should not be empty.')

		hasValidChars = validCharsRegExp.test(appName)

		if not hasValidChars or _.startsWith(appName, '-') or _.endsWith(appName, '-')
			throw new Error('Application name may only contain lowercase characters, digits and one or more dashes. It may not start or end with a dash.')

		return appName

	form.run [
		message: 'Select a name for the application'
		name: 'appname'
		type: 'input'
	],
		override:
			appname: preferredAppName
	.get('appname')
	.call('trim')
	.then(validateAppName)

# Select a sync destination folder
exports.selectSyncDestination = (preferredDestination) ->
	form.run [
		message: 'Destination directory on device container [/usr/src/app]'
		name: 'destination'
		type: 'input'
	],
		override:
			destination: preferredDestination
	.get('destination')
	.then (destination) ->
		destination ? '/usr/src/app'

exports.selectLocalResinOsDevice = (timeout = 4000) ->
	new SpinnerPromise
		promise: discoverLocalResinOsDevices(timeout)
		startMessage: 'Discovering local resinOS devices..'
		stopMessage: 'Reporting discovered devices'
	.filter ({ address } = {}) ->
		return false if not address

		Promise.try ->
			docker = new Docker(host: address, port: dockerPort, timeout: dockerTimeout)
			docker.pingAsync()
		.return(true)
		.catchReturn(false)
	.then (devices) ->
		if _.isEmpty(devices)
			throw new Error('Could not find any local resinOS devices')

		return form.ask
			message: 'select a device'
			type: 'list'
			default: devices[0].ip
			choices: _.map devices, (device) ->
				return {
					name: "#{device.host or 'untitled'} (#{device.address})"
					value: device.address
				}
