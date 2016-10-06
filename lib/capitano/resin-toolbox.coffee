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
	signature: 'deploy [deviceIp]'
	description: 'Deploy your changes to a container on local ResinOS device '
	help: '''
		WARNING: If you're running Windows, this command only supports `cmd.exe`.

		Use this command to deploy your local changes to a container on a LAN-accessible resinOS device on the fly.

		If `Dockerfile` or any file in the 'build-triggers' list is changed, a new container will be built and run on your device.
		If not, changes will simply be synced with `rsync` into the application container.

		After every 'resin deploy' the updated settings will be saved in
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
		excluded when using rsync to update the container. You can choose to change this default behavior with the
		'--skip-gitignore' option.

		Examples:

			$ rtb deploy
			$ rtb deploy --app-name test_server --build-triggers package.json,requirements.txt
			$ rtb deploy --force
			$ rtb deploy --ignore lib/
			$ rtb deploy --verbose false
			$ rtb deploy 192.168.2.10 --source . --destination /usr/src/app
			$ rtb deploy 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
	'''
	primary: true
	options: [
			signature: 'source'
			parameter: 'path'
			description: 'root of project directory to deploy to device container'
			alias: 's'
		,
			signature: 'destination'
			parameter: 'path'
			description: 'destination path on device container'
			alias: 'd'
		,
			signature: 'ignore'
			parameter: 'paths'
			description: "comma delimited paths to ignore when syncing with 'rsync'"
			alias: 'i'
		,
			signature: 'skip-gitignore'
			boolean: true
			description: 'do not parse excluded/included files from .gitignore'
		,
			signature: 'before'
			parameter: 'command'
			description: 'execute a command before deploying'
			alias: 'b'
		,
			signature: 'after'
			parameter: 'command'
			description: 'execute a command after deploying'
			alias: 'a'
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
			signature: 'app-name'
			parameter: 'name'
			description: 'name of application container - should be unique among other containers running on the device'
			alias: 'n'
		,
			signature: 'build-triggers'
			parameter: 'files'
			description: 'comma delimited file list that will trigger a container rebuild/deploy if changed'
			alias: 'r'
		,
			signature: 'force'
			boolean: true
			description: 'force a container build and run'
			alias: 'f'
	]
	action: (params, options, done) ->
		Promise = require('bluebird')
		_ = require('lodash')
		chalk = require('chalk')
		form = require('resin-cli-form')
		{ save } = require('../config')
		{ findAvahiDevices } = require('../discover')
		{ getSyncOptions, loadResinSyncYml, checkForExistingImage, checkForExistingImageAndContainer, buildAndRunImage } = require('../utils')
		{ sync } = require('../sync')('local-resin-os-device')

		selectLocalResinOSDevice = ->
			findAvahiDevices()
			.then (devices) ->
				if _.isEmpty(devices)
					throw new Error('You don\'t have any local ResinOS devices')

				return form.ask
					message: 'select a device'
					type: 'list'
					default: devices[0].ip
					choices: _.map devices, (device) ->
						return {
							name: "#{device.name or 'untitled'} (#{device.ip})"
							value: device.ip
						}

		selectAppName = Promise.method ({ preferredAppName, dockerHostIp }) ->
			form.run [
				message: 'Select a name for the application'
				name: 'appname'
				type: 'input'
			],
				override:
					appname: preferredAppName
			.get('appname')
			.tap (appname) ->
				checkForExistingImage({ name: appname, dockerHostIp })
				.then (imageExists) ->
					if imageExists
						throw new Error("Application with name #{appname} already exists. You can either 'rtb undeploy #{appname}' or choose a different name")

		ensureDockerfileExists = Promise.method (baseDir) ->
			fs = require('fs')
			path = require('path')

			baseDir ?= process.cwd()
			try
				fs.accessSync(path.join(baseDir, 'Dockerfile'))
			catch
				throw new Error("No Dockerfile was found in the project directory: #{baseDir}")

		getDeviceIp = Promise.method (deviceIp) ->
			if deviceIp?
				return deviceIp
			return selectLocalResinOSDevice()

		# https://nodejs.org/api/crypto.html
		getFileHash = Promise.method (file, algo = 'sha256') ->
			new Promise (resolve, reject) ->
				try
					crypto = require('crypto')
					fs = require('fs')

					hash = crypto.createHash(algo)
					input = fs.createReadStream(file)
					input.on 'readable', ->
						data = input.read()
						if data?
							return hash.update(data)
						return resolve(hash.digest('hex'))
					.on('error', reject)
				catch err
					reject(err)

		# Takes a list of files ('buildTriggers') located in 'baseDir' and returns an object with their hashes:
		# Input: [ 'package.json', 'requirements.txt', 'Othertrigger' ]
		# Output: {
		#		'package_json': <sha256>
		#		'requiremenets_txt': <sha256>
		#		'Othertrigger': <sha256>
		#	}
		createBuildTriggerHashes = Promise.method (baseDir, buildTriggers) ->
			fs = require('fs')
			path = require('path')

			if not baseDir?
				throw new Error('baseDir is required to create build trigger hashes')

			buildTriggers ?= []

			# Dockerfile and package.json are always included as build triggers
			buildTriggers = _.union(buildTriggers, [ 'Dockerfile', 'package.json' ])

			# Filter out empty 'build-triggers' file names (e.g. when passing 'package.json,,,trigget.txt')
			# and files that cannot be accessed
			buildTriggers = _.chain(buildTriggers)
				.filter((filename) -> not _.isEmpty(filename))
				.map((filename) -> return filename.trim())
				.filter (filename) ->
					try
						fs.accessSync(path.join(baseDir, filename))
						return true
					catch err
						throw new Error("Could not read #{filename}: #{err}")
				.value()

			Promise.map buildTriggers, (filename) ->
				getFileHash(filename)
				.then (hash) ->
					result = {}
					result[filename?.replace('.', '_')] = hash
					return result

		checkBuildTriggers = Promise.method (baseDir, savedBuildTriggers) ->
			fs = require('fs')
			path = require('path')

			savedBuildTriggers = _.clone(savedBuildTriggers)

			savedBuildTriggers = _.map savedBuildTriggers, (val) ->
				[ filename, hash ] = _.toPairs(val)[0]
				filename = filename.replace('_', '.')
				return { "#{filename}": hash }

			Promise.map savedBuildTriggers, (trigger) ->
				[ filename, saved_hash ] = _.toPairs(trigger)[0]
				filename = path.join(baseDir, filename)

				# First, check if any of the files in 'savedBuildTriggers' is missing or is not accessible
				try
					fs.accessSync(filename)
				catch
					throw new Error("File cannot be accessed: #{filename}")

				# Then, check if its hash has changed
				getFileHash(filename)
				.then (hash) ->
					if hash isnt saved_hash
						throw new Error("Hashes for #{filename} do not match (saved #{saved_hash} vs found #{hash})")
			.then ->
				return false
			.catch ->
				return true

		buildAction = (resinSyncYml, deviceIp) ->
			selectAppName(dockerHostIp: deviceIp, preferredAppName: resinSyncYml['local_resinos']['app-name'])
			.then (appName) ->
				resinSyncYml['local_resinos']['app-name'] = appName
			.then ->
				createBuildTriggerHashes(resinSyncYml.source, resinSyncYml['local_resinos']['build-triggers'])
			.then (buildTriggers) ->
				resinSyncYml['local_resinos']['build-triggers'] = buildTriggers

				save(
					_.omit(resinSyncYml, [ 'source', 'verbose', 'progress' ])
					resinSyncYml.source
				)
			.then ->
				buildAndRunImage
					baseDir: resinSyncYml.source
					appname: resinSyncYml['local_resinos']['app-name']
					dockerHostIp: deviceIp
			.then ->
				console.log(chalk.green.bold('\nresin deploy completed successfully!'))
			.catch (err) ->
				console.log(chalk.red.bold('resin deploy failed.', err))
				process.exit(1)

		syncAction = (cliOptions, deviceIp) ->
			getSyncOptions(cliOptions)
			.then (syncOptions) ->
				sync(syncOptions, deviceIp)
			.then ->
				console.log(chalk.green.bold('\nresin deploy completed successfully!'))
			.catch (err) ->
				console.log(chalk.red.bold('resin deploy failed.', err))
				process.exit(1)

		# Capitano does not support comma separated options yet
		if options['build-triggers']?
			options['build-triggers'] = options['build-triggers'].split(',')

		loadResinSyncYml(options.source)
		.then (@resinSyncYml) =>
			ensureDockerfileExists()
		.then ->
			getDeviceIp(params.deviceIp)
		.then (@deviceIp) =>

			if not @resinSyncYml['local_resinos']?
				# If local_resinos property does not exist in .resin-sync.yml:
				#
				# - Select an appname (option or intercative) and save it in local_resinos: app-name
				# - Create local_resinos: buildtriggers: []
				# - save local_resinos field in .resin-sync.yml
				# - Build and run container

				@resinSyncYml['local_resinos'] = {}

				# Give precedence to command line 'build-trigger' options
				@resinSyncYml['local_resinos']['build-triggers'] = options['build-triggers'] ? []

				return buildAction(@resinSyncYml, @deviceIp)
			else
				# If local_resinos property exists in .resin-sync.yml:
				#
				# - Load appname. If it doesn't exist, prompt the user for it, save it in local_resinos: app-name and rebuild
				# - Load buildTriggers. If the list is empty or build-trigerrs argument has been passed, create
				# local_resinos: buildtriggers and rebuild
				# - Sync container

				if not @resinSyncYml['local_resinos']['app-name']?
					return buildAction(@resinSyncYml, @deviceIp)

				if not @resinSyncYml['local_resinos']['build-triggers']? or options['build-triggers']?
					return buildAction(@resinSyncYml, @deviceIp)

				checkForExistingImageAndContainer({ name: @resinSyncYml['local_resinos']['app-name'], dockerHostIp: @deviceIp })
				.then (appExists) =>
					if not appExists
						return buildAction(@resinSyncYml, @deviceIp)

					checkBuildTriggers(@resinSyncYml.source, @resinSyncYml['local_resinos']['build-triggers'])
					.then (needsRebuild) =>
						if needsRebuild
							return buildAction(@resinSyncYml, @deviceIp)
						else
							return syncAction(options, @deviceIp)
		.catch (err) ->
			console.log 'Error', err, err?.stack
			throw err
		.nodeify(done)
