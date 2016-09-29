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

module.exports =
	signature: 'sync [uuid]'
	description: '(beta) sync your changes to a device'
	help: '''
		WARNING: If you're running Windows, this command only supports `cmd.exe`.

		Use this command to sync your local changes to a certain device on the fly.

		After every 'resin sync' the updated settings will be saved in
		'<source>/.resin-sync.yml' and will be used in later invocations. You can
		also change any option by editing '.resin-sync.yml' directly.

		Here is an example '.resin-sync.yml' :

			$ cat $PWD/.resin-sync.yml
			uuid: 7cf02a6
			destination: '/usr/src/app'
			before: 'echo Hello'
			after: 'echo Done'
			ignore:
				- .git
				- node_modules/

		Command line options have precedence over the ones saved in '.resin-sync.yml'.

		If '.gitignore' is found in the source directory then all explicitly listed files will be
		excluded from the syncing process. You can choose to change this default behavior with the
		'--skip-gitignore' option.

		Examples:

			$ resin sync 7cf02a6 --source . --destination /usr/src/app
			$ resin sync 7cf02a6 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
			$ resin sync --ignore lib/
			$ resin sync --verbose false
			$ resin sync
	'''
	permission: 'user'
	primary: true
	options: [
			signature: 'source'
			parameter: 'path'
			description: 'local directory path to synchronize to device'
			alias: 's'
		,
			signature: 'destination'
			parameter: 'path'
			description: 'destination path on device'
			alias: 'd'
		,
			signature: 'ignore'
			parameter: 'paths'
			description: 'comma delimited paths to ignore when syncing'
			alias: 'i'
		,
			signature: 'skip-gitignore'
			boolean: true
			description: 'do not parse excluded/included files from .gitignore'
		,
			signature: 'before'
			parameter: 'command'
			description: 'execute a command before syncing'
			alias: 'b'
		,
			signature: 'after'
			parameter: 'command'
			description: 'execute a command after syncing'
			alias: 'a'
		,
			signature: 'port'
			parameter: 'port'
			description: 'ssh port'
			alias: 't'
		,
			signature: 'progress'
			boolean: true
			description: 'show progress'
			alias: 'p'
		,
			signature: 'verbose'
			boolean: true
			description: 'increase verbosity'
			alias: 'v'
		,
	]
	action: (params, options, done) ->
		Promise = require('bluebird')
		_ = require('lodash')
		form = require('resin-cli-form')
		{ save } = require('../config')
		{ getSyncOptions } = require('../utils')
		{ getRemoteResinioOnlineDevices } = require('../discover')
		{ sync, ensureDeviceIsOnline, } = require('../sync')('remote-resin-io-device')

		# Resolves with uuid of selected online device, throws on error
		selectOnlineDevice = ->
			getRemoteResinioOnlineDevices()
			.then (onlineDevices) ->
				if _.isEmpty(onlineDevices)
					throw new Error('You don\'t have any devices online')

				return form.ask
					message: 'Select a device'
					type: 'list'
					default: onlineDevices[0].uuid
					choices: _.map onlineDevices, (device) ->
						return {
							name: "#{device.name or 'Untitled'} (#{device.uuid.slice(0, 7)})"
							value: device.uuid
						}

		Promise.try ->
			# If uuid was explicitly passed as a parameter then make sure it exists or fail otherwise
			if params?.uuid
				return ensureDeviceIsOnline(params.uuid)

			getSyncOptions(options)
			.then (@syncOptions) =>
				if @syncOptions.uuid?
					# If the saved uuid in .resin-sync.yml refers to a device that does not exist
					# or is offline then present device selection dialog instead of failing with an error
					return ensureDeviceIsOnline(@syncOptions.uuid).catch ->
						console.log "Device #{@syncOptions.uuid} not found or is offline."
						return selectOnlineDevice()

				# If no saved uuid was found, present dialog to select an online device
				return selectOnlineDevice()
			.then (uuid) =>
				_.assign(@syncOptions, { uuid })
				_.defaults(@syncOptions, port: 22)

				# Save options to `.resin-sync.yml`
				save(
					_.omit(@syncOptions, [ 'source', 'verbose', 'progress' ])
					@syncOptions.source
				)
			.then =>
				sync(@syncOptions)
		.nodeify(done)
