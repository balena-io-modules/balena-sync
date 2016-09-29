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
	signature: 'resin-toolbox [deviceIp]'
	description: 'Sync your changes to a container on local resinOS device '
	help: '''
		WARNING: If you're running Windows, this command only supports `cmd.exe`.

		Use this command to sync your local changes to a container on a LAN-accessible resinOS device on the fly.

		After every 'resin sync' the updated settings will be saved in
		'<source>/.resin-sync.yml' and will be used in later invocations. You can
		also change any option by editing '.resin-sync.yml' directly.

		Here is an example '.resin-sync.yml' :

			$ cat $PWD/.resin-sync.yml
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

			$ resin-toolbox sync
			$ resin-toolbox sync --ignore lib/
			$ resin-toolbox sync --verbose false
			$ resin-toolbox sync 192.168.2.10 --source . --destination /usr/src/app
			$ resin-toolbox sync 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
	'''
	options: [
			signature: 'source'
			parameter: 'path'
			description: 'local directory path to synchronize to device container'
			alias: 's'
		,
			signature: 'destination'
			parameter: 'path'
			description: 'destination path on device container'
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
		fs = require('fs')
		path = require('path')
		Promise = require('bluebird')
		{ selectLocalResinOSDevice } = require('../utils')
		resinSync = require('../sync')('local-resin-os-device')
		{ findAvahiDevices } = require('../autodiscovery')

		Promise.try ->
			try
				fs.accessSync(path.join(process.cwd(), '.resin-sync.yml'))
			catch
				if not options.source?
					throw new Error('No --source option passed and no \'.resin-sync.yml\' file found in current directory.')

			options.source ?= process.cwd()

			# TODO: Add comma separated options to Capitano
			if options.ignore?
				options.ignore = options.ignore.split(',')

			Promise.try ->
				findAvahiDevices()
				.then(selectLocalResinOSDevice)
			.then (deviceIp) ->
				resinSync(deviceIp, options)
		.nodeify(done)
