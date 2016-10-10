fs = require('fs')
path = require('path')
Docker = require('docker-toolbelt')
Promise = require('bluebird')
es = require 'event-stream'
JSONStream = require 'JSONStream'
tar = require('tar-fs')
ssh2 = require('ssh2')
Promise.promisifyAll(ssh2.Client)
semver = require('semver')
_ = require('lodash')

docker = null

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
Docker::containerRootDir = (container, host, port = 22222) ->
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

defaultVolumes = {
	'/data': {}
	'/lib/modules': {}
	'/lib/firmware': {}
	'/host/var/lib/connman': {}
	'/host/run/dbus': {}
}

defaultBinds = (dataPath) ->
	data = path.join('/resin-data', dataPath) + ':/data'

	return [
		data
		'/lib/modules:/lib/modules'
		'/lib/firmware:/lib/firmware'
		'/run/dbus:/host_run/dbus'
		'/run/dbus:/host/run/dbus'
	]

# image can be either ID or name
getContainerStartOptions = Promise.method (image) ->
	throw new Error('Please give an image name or ID') if not image

	# TODO: add kmod bind mount
	binds = defaultBinds(image)

	return {
		Privileged: true
		NetworkMode: 'host'
		Binds: binds
		RestartPolicy:
			Name: 'always'
			MaximumRetryCount: 0
	}

ensureDockerInit = ->
	throw new Error('Docker client not initialized') if not docker?

module.exports =
		dockerInit: (dockerHostIp = '127.0.0.1', dockerPort = 2375) ->
			if not docker?
				docker = new Docker(host: dockerHostIp, port: dockerPort)
			return docker

		# Resolve with true if image with 'name' exists. Resolve
		# false otherwise and reject promise on unknown error
		checkForExistingImage: Promise.method (name) ->
			ensureDockerInit()

			docker.getImage(name).inspectAsync()
			.then (imageInfo) ->
				return true
			.catch (err) ->
				statusCode = '' + err.statusCode
				if statusCode is '404'
					return false
				throw new Error("Error while inspecting image #{name}: #{err}")

		# Resolve with true if container with 'name' exists and is running. Resolve
		# false otherwise and reject promise on unknown error
		checkForRunningContainer: Promise.method (name) ->
			ensureDockerInit()

			docker.getContainer(name).inspectAsync()
			.then (containerInfo) ->
				return containerInfo?.State?.Running ? false
			.catch (err) ->
				statusCode = '' + err.statusCode
				if statusCode is '404'
					return false
				throw new Error("Error while inspecting container #{name}: #{err}")

		buildImage: ({ baseDir, name, outStream }) ->
			Promise.try ->
				ensureDockerInit()

				outStream ?= process.stdout
				tarStream = tar.pack(baseDir)

				docker.buildImageAsync(tarStream, t: "#{name}")
			.then (output) ->
				new Promise (resolve, reject) ->
					output.pipe(JSONStream.parse())
					.pipe(es.through (data) ->
						if data.error?
							return reject(new Error(data.error))

						if data.stream?
							str = "#{data.stream}\r"
						else if data.status in [ 'Downloading', 'Extracting' ]
							str = "#{data.status} #{data.progress ? ''}\r"
						else
							str = "#{data.status}\n"

						@emit('data', str) if str?
					, -> resolve(true))
					.pipe(outStream)

		createContainer: (name) ->
			Promise.try ->
				ensureDockerInit()
				docker.getImage(name).inspectAsync()
			.then (imageInfo) ->
				if imageInfo?.Config?.Cmd
					cmd = imageInfo.Config.Cmd
				else
					cmd = [ '/bin/bash', '-c', '/start' ]

				docker.createContainerAsync
					Image: name
					Cmd: cmd
					Tty: true
					Volumes: defaultVolumes
					name: name

		startContainer: (name) ->
			Promise.try ->
				ensureDockerInit()
				docker.getContainer(name).startAsync(getContainerStartOptions(name))
			.catch (err) ->
				# Throw unless the error code is 304 (the container was already started)
				statusCode = '' + err.statusCode
				if statusCode isnt '304'
					throw new Error("Error while starting container #{name}: #{err}")

		stopContainer: (name) ->
			Promise.try ->
				ensureDockerInit()
				docker.getContainer(name).stopAsync(t: 10)
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
			Promise.try ->
				ensureDockerInit()
				docker.getContainer(name).removeAsync(v: true)
			.catch (err) ->
				# Throw unless the error code is 404 (the container was not found)
				statusCode = '' + err.statusCode
				if statusCode isnt '404'
					throw new Error("Error while removing container #{name}: #{err}")

		removeImage: (name) ->
			Promise.try ->
				ensureDockerInit()
				docker.getImage(name).removeAsync(force: true)
			.catch (err) ->
				# Image removal should be considered successful if we receive any
				# of these error codes:
				#
				# 404: image not found
				statusCode = '' + err.statusCode
				if statusCode isnt '404'
					throw new Error("Error while removing image #{name}: #{err}")

		inspectImage: (name) ->
			Promise.try ->
				ensureDockerInit()
				docker.getImage(name).inspectAsync()
