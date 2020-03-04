Promise = require('bluebird')
_ = require('lodash')
Docker = require('docker-toolbelt')
form = require('resin-cli-form')
{ discoverLocalBalenaOsDevices } = require('./discover')
{ SpinnerPromise } = require('resin-cli-visuals')
{ dockerPort, dockerTimeout } = require('./config')

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

exports.selectLocalBalenaOsDevice = (timeout = 4000) ->
	new SpinnerPromise
		promise: discoverLocalBalenaOsDevices(timeout)
		startMessage: 'Discovering local balenaOS devices..'
		stopMessage: 'Reporting discovered devices'
	.filter ({ address } = {}) ->
		return false if not address

		Promise.try ->
			docker = new Docker(host: address, port: dockerPort, timeout: dockerTimeout)
			docker.ping()
		.return(true)
		.catchReturn(false)
	.then (devices) ->
		if _.isEmpty(devices)
			throw new Error('Could not find any local balenaOS devices')

		return form.ask
			message: 'select a device'
			type: 'list'
			default: devices[0].ip
			choices: _.map devices, (device) ->
				return {
					name: "#{device.host or 'untitled'} (#{device.address})"
					value: device.address
				}
