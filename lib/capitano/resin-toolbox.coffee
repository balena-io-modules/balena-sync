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
	signature: 'push [deviceIp]'
	description: 'Push your changes to a container on local ResinOS device '
	help: '''
		WARNING: If you're running Windows, this command only supports `cmd.exe`.

		Use this command to push your local changes to a container on a LAN-accessible resinOS device on the fly.

		If `Dockerfile` or any file in the 'build-triggers' list is changed, a new container will be built and run on your device.
		If not, changes will simply be synced with `rsync` into the application container.

		After every 'resin push' the updated settings will be saved in
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

			$ rtb push
			$ rtb push --app-name test_server --build-triggers package.json,requirements.txt
			$ rtb push --force-build
			$ rtb push --ignore lib/
			$ rtb push --verbose false
			$ rtb push 192.168.2.10 --source . --destination /usr/src/app
			$ rtb push 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
	'''
	primary: true
	options: [
			signature: 'source'
			parameter: 'path'
			description: 'root of project directory to push'
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
			description: 'execute a command before pushing'
			alias: 'b'
		,
			signature: 'after'
			parameter: 'command'
			description: 'execute a command after pushing'
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
			description: 'comma delimited file list that will trigger a container rebuild if changed'
			alias: 'r'
		,
			signature: 'force-build'
			boolean: true
			description: 'force a container build and run'
			alias: 'f'
	]
	action: (params, options, done) ->
		fs = require('fs')
		path = require('path')
		crypto = require('crypto')
		Promise = require('bluebird')
		_ = require('lodash')
		chalk = require('chalk')
		form = require('resin-cli-form')
		{ save } = require('../config')
		{ getSyncOptions, loadResinSyncYml } = require('../utils')
		{ selectLocalResinOsDeviceForm } = require('../discover')
		{ dockerInit
			checkForExistingImage
			checkForExistingContainer
			buildImage
			removeImage
			inspectImage
			createContainer
			startContainer
			stopContainer
			removeContainer } = require('../docker-utils')
		{ sync } = require('../sync')('local-resin-os-device')

		setAppName = Promise.method (resinSyncYml, preferredAppName) ->
			form.run [
				message: 'Select a name for the application'
				name: 'appname'
				type: 'input'
			],
				override:
					appname: preferredAppName
			.get('appname')
			.tap (appName) ->
				resinSyncYml['local_resinos']['app-name'] = appName
				save(_.omit(resinSyncYml, [ 'source' ]), resinSyncYml.source)

		# Returns true if it does, false if it doesnt and throws synchronously on error
		checkFileExistsSync = (filename) ->
			try
				fs.accessSync(filename)
				return true
			catch err
				if err.code is 'ENOENT'
					return false
				throw new Error("Could not access #{filename}: #{err}")

		ensureDockerfileExists = Promise.method (baseDir) ->
			baseDir ?= process.cwd()
			dockerfileExists = checkFileExistsSync(path.join(baseDir, 'Dockerfile'))

			if not dockerfileExists
				throw new Error("No Dockerfile was found in the project directory: #{baseDir}")

		getDeviceIp = Promise.method (deviceIp) ->
			if deviceIp?
				return deviceIp
			return selectLocalResinOsDeviceForm()

		# https://nodejs.org/api/crypto.html
		getFileHash = Promise.method (file, algo = 'sha256') ->
			new Promise (resolve, reject) ->
				try

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
		createBuildTriggerHashes = Promise.method (baseDir, buildTriggersList = []) ->

			if not baseDir?
				throw new Error('baseDir is required to create build trigger hashes')

			# Dockerfile and package.json are always included as build triggers
			buildTriggersList = _.union(buildTriggersList, [ 'Dockerfile', 'package.json' ])

			# Filter out empty 'build-triggers' file names (e.g. when passing 'package.json,,,trigger.txt')
			# and files that cannot be accessed
			buildTriggersList = _.chain(buildTriggersList)
				.filter((filename) -> not _.isEmpty(filename))
				.map((filename) -> return filename.trim())
				.filter (filename) ->
					checkFileExistsSync(path.join(baseDir, filename))
				.value()

			Promise.map buildTriggersList, (filename) ->
				getFileHash(filename)
				.then (hash) ->
					result = {}
					result[filename] = hash

					return result

		setBuildTriggerHashes = Promise.method (resinSyncYml, buildTriggersList = []) ->
			createBuildTriggerHashes(resinSyncYml['source'], buildTriggersList)
			.then (buildTriggerHashes) ->
				resinSyncYml['local_resinos']['build-triggers'] = buildTriggerHashes
				save(_.omit(resinSyncYml, [ 'source' ]), resinSyncYml.source)

		# resolved with 'true', if any hash has changed or if any of the files
		# listed in local_resinos: build-triggers could not be accessed or was missing.
		#
		# resolves with 'false' if the hashes in local_resinos: build-triggers  match
		# the ones of the corresponding files on the filesystem.
		checkBuildTriggers = Promise.method (resinSyncYml) ->

			savedBuildTriggers = resinSyncYml?['local_resinos']?['build-triggers']
			if not savedBuildTriggers
				return true

			baseDir = resinSyncYml['source']

			Promise.map savedBuildTriggers, (trigger) ->
				[ filename, saved_hash ] = _.toPairs(trigger)[0]

				filename = path.join(baseDir, filename)

				# First, check if any of the files in 'savedBuildTriggers' is missing or is not accessible
				fileExists = checkFileExistsSync(filename)
				if not fileExists
					return true

				# Then, check if its hash has changed
				getFileHash(filename)
				.then (hash) ->
					if hash isnt saved_hash
						return true
					return false
			.then (results) ->
				true in results
			.catch (err) ->
				console.log('Error while checking build trigger hashes', err)
				return true

		buildAction = (appName, sourceDir, outStream) ->
			if not appName?
				throw new Error('Please pass an image/container name to build')

			console.log(chalk.yellow.bold('* Building..'))

			console.log "- Stopping and Removing any previous '#{appName}' container"
			stopContainer(appName)
			.then ->
				removeContainer(appName)
			.then ->
				# Get existing image id and remove it after building new one to preserve build cache
				inspectImage(appName)
				.catch (err) ->
					statusCode = '' + err.statusCode
					return null if statusCode is '404'
					throw err
			.then (oldImageInfo) ->
				console.log "- Building new '#{appName}' image"
				buildImage
					baseDir: sourceDir ? process.cwd()
					name: appName
					outStream: outStream ? process.stdout
				.then ->
					# Clean up previous image only if new build resulted in different image hash
					inspectImage(appName)
				.then (newImageInfo) ->
					if oldImageInfo? and oldImageInfo.Id isnt newImageInfo.Id
						console.log "- Cleaning up previous image of '#{appName}'"
						removeImage(imageInfo.Id)
			.then ->
				console.log "- Creating '#{appName}' container"
				createContainer(appName)
			.then ->
				console.log "- Starting '#{appName}' container"
				startContainer(appName)
			.then ->
				console.log(chalk.green.bold('\nresin push completed successfully!'))
			.catch (err) ->
				console.log(chalk.red.bold('resin push failed.', err))
				process.exit(1)

		syncAction = (cliOptions, deviceIp) ->
			console.log(chalk.yellow.bold('* Syncing..'))
			getSyncOptions(cliOptions)
			.then (syncOptions) ->
				sync(syncOptions, deviceIp)
			.then ->
				console.log(chalk.green.bold('\nresin push completed successfully!'))
			.catch (err) ->
				console.log(chalk.red.bold('resin push failed.', err))
				process.exit(1)

		# Capitano does not support comma separated options yet
		if options['build-triggers']?
			options['build-triggers'] = options['build-triggers'].split(',')

		cliBuildTriggersList = options['build-triggers']
		cliAppName = options['app-name']
		cliForceBuild = options['force-build'] ? false

		loadResinSyncYml(options.source)
		.then (@resinSyncYml) =>
			ensureDockerfileExists()
		.then ->
			getDeviceIp(params.deviceIp)
		.then (@deviceIp) =>
			dockerInit(@deviceIp)
		.then =>
			if not @resinSyncYml['local_resinos']?
				@resinSyncYml['local_resinos'] = {}

			# Give precedence to cli passed 'app-name'
			appName = cliAppName ? @resinSyncYml['local_resinos']['app-name']
			setAppName(@resinSyncYml, appName)
		.then (appName) =>

			savedBuildTriggers = @resinSyncYml['local_resinos']['build-triggers']
			savedBuildTriggersList = _.map savedBuildTriggers, (trigger) -> _.toPairs(trigger)[0][0]

			buildDir = @resinSyncYml['source']

			# If builder trigger list is empty in resin sync yml or explicit 'build-trigger'
			# option was passed then force rebuild
			if _.isEmpty(savedBuildTriggers) or cliBuildTriggersList?
				return setBuildTriggerHashes(@resinSyncYml, cliBuildTriggersList).then ->
					buildAction(appName, buildDir)

			# If '--force-build' action is passed, rebuild
			if cliForceBuild
				return buildAction(appName, buildDir)

			checkBuildTriggers(@resinSyncYml)
			.then (shouldRebuild) =>

				if shouldRebuild
					return setBuildTriggerHashes(@resinSyncYml, savedBuildTriggersList).then ->
						buildAction(appName, buildDir)

				Promise.props
					containerExists: checkForExistingContainer(appName)
					imageExists: checkForExistingImage(appName)
				.then ({ containerExists, imageExists }) =>
					if not containerExists or not imageExists
						return buildAction(appName, buildDir)
					return syncAction(options, @deviceIp)
		.nodeify(done)
