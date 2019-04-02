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

module.exports =
	signature: 'sync [uuid]'
	description: '(beta) sync your changes to a device'
	help: '''
		Warning: 'balena sync' requires an openssh-compatible client and 'rsync' to
		be correctly installed in your shell environment. For more information (including
		Windows support) please check the README here: https://github.com/balena-io/balena-cli

		Use this command to sync your local changes to a certain device on the fly.

		After every 'balena sync' the updated settings will be saved in
		'<source>/.balena-sync.yml' and will be used in later invocations. You can
		also change any option by editing '.balena-sync.yml' directly.

		Here is an example '.balena-sync.yml' :

			$ cat $PWD/.balena-sync.yml
			uuid: 7cf02a6
			destination: '/usr/src/app'
			before: 'echo Hello'
			after: 'echo Done'
			ignore:
				- .git
				- node_modules/

		Command line options have precedence over the ones saved in '.balena-sync.yml'.

		If '.gitignore' is found in the source directory then all explicitly listed files will be
		excluded from the syncing process. You can choose to change this default behavior with the
		'--skip-gitignore' option.

		Examples:

			$ balena sync 7cf02a6 --source . --destination /usr/src/app
			$ balena sync 7cf02a6 -s /home/user/myBalenaProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
			$ balena sync --ignore lib/
			$ balena sync --verbose false
			$ balena sync
	'''
	permission: 'user'
	primary: false
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
			signature: 'skip-restart'
			boolean: true
			description: 'do not restart container after syncing'
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
		yamlConfig = require('../yaml-config')
		parseOptions = require('./parse-options')
		{ getRemoteBalenaOnlineDevices } = require('../discover')
		{ selectSyncDestination } = require('../forms')
		{ sync, ensureDeviceIsOnline } = require('../sync')('remote-balena-io-device')

		# Resolves with uuid of selected online device, throws on error
		selectOnlineDevice = ->
			getRemoteBalenaOnlineDevices()
			.then (onlineDevices) ->
				if _.isEmpty(onlineDevices)
					throw new Error('You don\'t have any devices online')

				return form.ask
					message: 'Select a device'
					type: 'list'
					default: onlineDevices[0].uuid
					choices: _.map onlineDevices, (device) ->
						return {
							name: "#{device.device_name or 'Untitled'} (#{device.uuid.slice(0, 7)})"
							value: device.uuid
						}

		{ runtimeOptions, configYml } = parseOptions(options, params)

		Promise.try ->
			# If uuid was explicitly passed as a parameter then make sure it exists or fail otherwise
			if params?.uuid
				return ensureDeviceIsOnline(params.uuid)


			if configYml.uuid?
				# If the saved uuid in .balena-sync.yml refers to a device that does not exist
				# or is offline then present device selection dialog instead of failing with an error
				return ensureDeviceIsOnline(configYml.uuid).catch ->
					console.log "Device #{configYml.uuid} not found or is offline."
					return selectOnlineDevice()
			else
				# If no saved uuid was found, present dialog to select an online device
				return selectOnlineDevice()
		.then (uuid) ->
			# Update runtime option based on user choice
			runtimeOptions.uuid = uuid

			# Select sync destination
			selectSyncDestination(runtimeOptions.destination)
		.then (destination) ->
			# Update runtime option based on user choice
			runtimeOptions.destination = destination

			# Save config file before starting sync
			notNil = (val) -> not _.isNil(val)
			yamlConfig.save(
				_.assign({}, configYml, _(runtimeOptions).pick([ 'uuid', 'destination', 'port', 'ignore', 'before', 'after' ]).pickBy(notNil).value())
				configYml.baseDir
			)
		.then ->
			sync _.pick runtimeOptions, [
				'uuid'
				'port'
				'baseDir'
				'appName'
				'destination'
				'before'
				'after'
				'progress'
				'verbose'
				'skipRestart'
				'skipGitignore'
				'ignore'
			]
		.nodeify(done)
