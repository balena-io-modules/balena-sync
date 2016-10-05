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

path = require('path')
fs = require('fs')
Promise = require('bluebird')
_ = require('lodash')
chalk = require('chalk')
ssh2 = require('ssh2')
semver = require('semver')
Promise.promisifyAll(ssh2.Client)
Docker = require('docker-toolbelt')
shell = require('../shell')
{ buildRsyncCommand } = require('../rsync')
{ spinnerPromise
	startContainer
	stopContainer
	startContainerAfterError
	getContainerStartOptions
} = require('../utils')

# resolved with file contents, rejects on error
readFileViaSSH = Promise.method (host, port, file) ->
	getSSHConnection = ->
		new Promise (resolve, reject) ->
			client = new ssh2.Client()
			client.on 'ready', ->
				resolve(client)
			.on 'error', (err) ->
				errSource = if err?.level then 'client-socket' else 'client-ssh'
				errMsg = "#{errSource} error during SSH connection: #{err?.description}"
				reject(new Error(errMsg))
			.connect
				username: 'root'
				agent: process.env.SSH_AUTH_SOCK
				host: host
				port: port
				keepaliveCountMax: 3
				keepaliveInterval: 10000
				readyTimeout: 30000
				tryKeyboard: false
		.disposer((client) -> client.end())

	Promise.using getSSHConnection(), (client) ->
		client.execAsync("cat #{file}")
		.then (stream) ->
			new Promise (resolve, reject) ->
				bufStdout = []
				stream.on 'data', (chunk) ->
					bufStdout.push(chunk)
				.on 'close', (code, signal) ->
					data = Buffer.concat(bufStdout).toString()
					resolve({ data, code, signal })
				.on('error', reject)
			.tap ({ data, code, signal }) ->
				if code isnt 0
					throw new Error("Could not read file from Docker Host. Code: #{code}")
			.get('data')

# Gets a string `container` (id or name) as input and returns a promise that
# resolves to the absolute path of the root directory for that container
#
# Setting the 'host' parameter implies that the docker host is located on a network-accessible device,
# so any file reads will take place on that host (instead of locally) over SSH.
#
Docker::containerRootDir = (container, host, port) ->
	Promise.all [
		@infoAsync()
		@versionAsync().get('Version')
		@getContainer(container).inspectAsync()
	]
	.spread (dockerInfo, dockerVersion, containerInfo) ->
		dkroot = dockerInfo.DockerRootDir

		containerId = containerInfo.Id

		Promise.try ->
			if semver.lt(dockerVersion, '1.10.0')
				return containerId

			destFile = path.join(dkroot, "image/#{dockerInfo.Driver}/layerdb/mounts", containerId, 'mount-id')

			if host?
				port ?= 22222
				readFile = _.partial(readFileViaSSH, host, port)
			else
				readFile = fs.readFileAsync

			# Resolves with 'destId'
			readFile(destFile)
		.then (destId) ->
			switch dockerInfo.Driver
				when 'btrfs'
					path.join(dkroot, 'btrfs/subvolumes', destId)
				when 'overlay'
					containerInfo.GraphDriver.Data.RootDir
				when 'vfs'
					path.join(dkroot, 'vfs/dir', destId)
				else
					throw new Error("Unsupported driver: #{dockerInfo.Driver}/")


exports.sync = (syncOptions) ->

	{ source, destination, before, after, deviceIp, port, local_resinos: 'app-name': appName } = syncOptions

	throw new Error("'destination' is a required sync option") if not destination?
	throw new Error("'deviceIp' is a required sync option") if not deviceIp?
	throw new Error("'app-name' is a required sync option") if not appName?

	docker = new Docker(host: deviceIp, port: 2375)

	getStopContainerPromise = Promise.method (appName) ->
		docker.getContainer(appName).stopAsync(t: 10).catch Promise.OperationalError, (err) ->
			# Bluebird throws OperationalError for errors resulting in the normal execution of a promisified function.
			# Throw unless the error code is 304 (the container was already stopped)
			statusCode = '' + err.statusCode
			return if statusCode is '304'
			throw err

	getStartContainerPromise = (appName) ->
		getContainerStartOptions(appName)
		.then (startOptions) ->
			docker.getContainer(appName).startAsync(startOptions).catch Promise.OperationalError, (err) ->
				# Bluebird throws OperationalError for errors resulting in the normal execution of a promisified function.
				# Throw unless the error code is 304 (the container was already started)
				statusCode = '' + err.statusCode
				return if statusCode is '304'
				throw err

	syncContainer = (appName, destination, host, port = 22222) ->
		docker.containerRootDir(appName, host, port)
		.then (containerRootDirLocation) ->

			rsyncDestination = path.join(containerRootDirLocation, destination)

			_.assign syncOptions,
						username: 'root'
						host: host
						port: port
						destination: rsyncDestination

			command = buildRsyncCommand(syncOptions)

			console.log 'running ', command

			spinnerPromise(
				shell.runCommand(command, cwd: source)
				"Syncing to #{destination} on '#{appName}'..."
				"Synced #{destination} on '#{appName}'."
			)

	Promise.try ->
		if before?
			shell.runCommand(before, source)
	.then -> # stop container
		stopContainer(getStopContainerPromise(appName))
	.then -> # sync container
		syncContainer(appName, destination, deviceIp, port)
		.then -> # start container
			startContainer(getStartContainerPromise(appName))
		.then -> # run 'after' action
			if after?
				shell.runCommand(after, source)
		.then ->
			console.log(chalk.green.bold('\nresin sync completed successfully!'))
		.catch (err) ->
			# Notify the user of the error and run 'startApplication()'
			# once again to make sure that a new app container will be started
			startContainerAfterError(getStartContainerPromise(appName))
			.catch (err) ->
				console.log('Could not start application container', err)
			.finally ->
				throw err
	.catch (err) ->
		console.log(chalk.red.bold('resin sync failed.', err))
		process.exit(1)
