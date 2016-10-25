fs = require('fs')
path = require('path')
Docker = require('docker-toolbelt')
Promise = require('bluebird')
JSONStream = require 'JSONStream'
tar = require('tar-fs')
ssh2 = require('ssh2')
Promise.promisifyAll(ssh2.Client)
semver = require('semver')
_ = require('lodash')
{ validateEnvVar } = require('./utils')

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

defaultVolumes = {
	'/data': {}
	'/lib/modules': {}
	'/lib/firmware': {}
	'/host/run/dbus': {}
}

defaultBinds = (dataPath) ->
	data = path.join('/mnt/data/resin-data', dataPath) + ':/data'

	return [
		data
		'/lib/modules:/lib/modules'
		'/lib/firmware:/lib/firmware'
		'/run/dbus:/host/run/dbus'
	]

# 'dockerProgressStream' is a stream of JSON objects emitted during the build
# 'outStream' is the output stream to pretty-print docker progress
#
# This function returns a promise that is rejected on error or resolves with 'true'
#
# Based on https://github.com/docker/docker/blob/master/pkg/jsonmessage/jsonmessage.go
#
prettyPrintDockerProgress = (dockerProgressStream, outStream = process.stdout) ->
	esc = '\u001B'

	clearCurrentLine = "#{esc}[2K\r"

	moveCursorUp = (rows = 0) ->
		"#{esc}[#{rows}A"

	moveCursorDown = (rows = 0) ->
		"#{esc}[#{rows}B"

	display = (jsonEvent = {}) ->
		{ id, progress, stream, status } = jsonEvent

		outStream.write(clearCurrentLine)

		if not _.isEmpty(id)
			outStream.write("#{id}: ")

		if not _.isEmpty(progress)
			outStream.write("#{status} #{progress}\r")
		else if not _.isEmpty(stream)
			outStream.write("#{stream}\r")
		else
			outStream.write("#{status}\r")

	new Promise (resolve, reject) ->
		if not dockerProgressStream?
			return reject(new Error("Missing parameter 'dockerProgressStream'"))

		ids = {}

		dockerProgressStream.pipe(JSONStream.parse())
		.on 'data', (jsonEvent = {}) ->
			{ error, id } = jsonEvent

			if error?
				return reject(new Error(error))

			diff = 0
			line = ids[id]

			if id?
				if not line?
					line = _.size(ids)
					ids[id] = line
					outStream.write('\n')
				else
					diff = _.size(ids) - line
				outStream.write(moveCursorUp(diff))
			else
				ids = {}

			display(jsonEvent)

			if id?
				outStream.write(moveCursorDown(diff))
		.on 'end', ->
			resolve(true)
		.on 'error', (error) ->
			reject(error)

class RdtDockerUtils
	constructor: (dockerHostIp, dockerPort = 2375) ->
		if not dockerHostIp?
			throw new Error('Device Ip/Host is required to instantiate an RdtDockerUtils client')
		@docker = new Docker(host: dockerHostIp, port: dockerPort)

	# Resolve with true if image with 'name' exists. Resolve
	# false otherwise and reject promise on unknown error
	checkForExistingImage: (name) ->
		Promise.try =>
			@docker.getImage(name).inspectAsync()
			.then (imageInfo) ->
				return true
			.catch (err) ->
				statusCode = '' + err.statusCode
				if statusCode is '404'
					return false
				throw new Error("Error while inspecting image #{name}: #{err}")

	# Resolve with true if container with 'name' exists and is running. Resolve
	# false otherwise and reject promise on unknown error
	checkForRunningContainer: (name) ->
		Promise.try =>
			@docker.getContainer(name).inspectAsync()
			.then (containerInfo) ->
				return containerInfo?.State?.Running ? false
			.catch (err) ->
				statusCode = '' + err.statusCode
				if statusCode is '404'
					return false
				throw new Error("Error while inspecting container #{name}: #{err}")

	buildImage: ({ baseDir, name, outStream }) ->
		Promise.try =>
			outStream ?= process.stdout
			tarStream = tar.pack(baseDir)

			@docker.buildImageAsync(tarStream, t: "#{name}")
		.then (dockerProgressOutput) ->
			prettyPrintDockerProgress(dockerProgressOutput, outStream)

	###*
	# @summary Create a container
	# @function createContainer
	#
	# @param {String} name - Container name - and Image with the same name must already exist
	# @param {Object} [options] - options
	# @param {Array} [options.env=[]] - environment variables in the form [ 'ENV=value' ]
	#
	# @returns {}
	# @throws Exception on error
	###
	createContainer: (name, { env = [] } = {}) ->
		Promise.try =>
			if not _.isArray(env)
				throw new Error('createContainer(): expecting an array of environment variables')

			@docker.getImage(name).inspectAsync()
		.then (imageInfo) =>
			if imageInfo?.Config?.Cmd
				cmd = imageInfo.Config.Cmd
			else
				cmd = [ '/bin/bash', '-c', '/start' ]

			@docker.createContainerAsync
				Image: name
				Cmd: cmd
				name: name
				Env: validateEnvVar(env)

	startContainer: (name) ->
		Promise.try =>
			@docker.getContainer(name).startAsync
				Volumes: defaultVolumes
				Privileged: true
				Tty: true
				Binds: defaultBinds(name)
				NetworkMode: 'host'
				RestartPolicy:
					Name: 'always'
					MaximumRetryCount: 0
		.catch (err) ->
			# Throw unless the error code is 304 (the container was already started)
			statusCode = '' + err.statusCode
			if statusCode isnt '304'
				throw new Error("Error while starting container #{name}: #{err}")

	stopContainer: (name) ->
		Promise.try =>
			@docker.getContainer(name).stopAsync(t: 10)
		.catch (err) ->
			# Container stop should be considered successful if we receive any
			# of these error codes:
			#
			# 404: container not found
			# 304: container already stopped
			statusCode = '' + err.statusCode
			if statusCode isnt '404' and statusCode isnt '304'
				throw new Error("Error while stopping container #{name}: #{err}")

	removeContainer: (name) ->
		Promise.try =>
			@docker.getContainer(name).removeAsync(v: true)
		.catch (err) ->
			# Throw unless the error code is 404 (the container was not found)
			statusCode = '' + err.statusCode
			if statusCode isnt '404'
				throw new Error("Error while removing container #{name}: #{err}")

	removeImage: (name) ->
		Promise.try =>
			@docker.getImage(name).removeAsync(force: true)
		.catch (err) ->
			# Image removal should be considered successful if we receive any
			# of these error codes:
			#
			# 404: image not found
			statusCode = '' + err.statusCode
			if statusCode isnt '404'
				throw new Error("Error while removing image #{name}: #{err}")

	inspectImage: (name) ->
		Promise.try =>
			@docker.getImage(name).inspectAsync()

	# Pipe stderr and stdout of container 'name' to stream
	pipeContainerStream: (name, outStream = process.stdout) ->
		Promise.try =>
			container = @docker.getContainer(name)
			container.inspectAsync().then (containerInfo) ->
				return containerInfo?.State?.Running
			.then (isRunning) ->
				container.attachAsync
					logs: not isRunning
					stream: isRunning
					stdout: true
					stderr: true
			.then (containerStream) ->
				containerStream.pipe(outStream)

	followContainerLogs: (appName, outStream = process.stdout) ->
		Promise.try =>
			if not appName?
				throw new Error('Please give an application name to stream logs from')

			@pipeContainerStream(appName, outStream)

	# Gets a string `container` (id or name) as input and returns a promise that
	# resolves to the absolute path of the root directory for that container
	#
	# Setting the 'host' parameter implies that the docker host is located on a network-accessible device,
	# so any file reads will take place on that host (instead of locally) over SSH.
	#
	containerRootDir: (container, host, port) ->
		Promise.all [
			@docker.infoAsync()
			@docker.versionAsync().get('Version')
			@docker.getContainer(container).inspectAsync()
		]
		.spread (dockerInfo, dockerVersion, containerInfo) ->
			dkroot = dockerInfo.DockerRootDir

			containerId = containerInfo.Id

			Promise.try ->
				if semver.lt(dockerVersion, '1.10.0')
					return containerId

				destFile = path.join(dkroot, "image/#{dockerInfo.Driver}/layerdb/mounts", containerId, 'mount-id')

				if host?
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
					when 'aufs'
						path.join(dkroot, 'aufs/mnt', destId)
					else
						throw new Error("Unsupported driver: #{dockerInfo.Driver}/")

module.exports = RdtDockerUtils
