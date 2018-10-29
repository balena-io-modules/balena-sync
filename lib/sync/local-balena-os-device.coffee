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

path = require('path')
Promise = require('bluebird')
shellwords = require('shellwords')
shell = require('../shell')
DockerUtils = require('../docker-utils')
{ SpinnerPromise } = require('resin-cli-visuals')
{ buildRsyncCommand } = require('../rsync')
{	startContainerSpinner
	stopContainerSpinner
	startContainerAfterErrorSpinner } = require('../utils')

DEVICE_SSH_PORT = 22222

###*
# @summary Run rsync on a local balenaOS device
# @function sync
#
# @param {Object} options - options
# @param {String} options.deviceIp - Destination device ip/host
# @param {String} options.baseDir - Project base dir
# @param {String} options.appName - Application container name
# @param {String} options.destination - Sync destination folder in container
# @param {String} [options.before] - Action to execute locally before sync
# @param {String} [options.after] - Action to execute locally after sync
# @param {String} [options.progress=false] - Show progress
# @param {String} [options.verbose=false] - Show progress
# @param {String} [options.skipGitignore=false] - Skip .gitignore parsing
# @param {String} [options.ignore] - rsync ignore list
#
# @returns {}
# @throws Exception on error
#
# @example
# sync()
###
exports.sync = ({ deviceIp, baseDir, appName, destination, before, after, progress = false, verbose = false, skipGitignore = false, ignore } = {}) ->

	throw new Error("'destination' is a required sync option") if not destination?
	throw new Error("'deviceIp' is a required sync option") if not deviceIp?
	throw new Error("'app-name' is a required sync option") if not appName?

	docker = new DockerUtils(deviceIp)

	Promise.try ->
		if before?
			shell.runCommand(before, baseDir)
	.then -> # sync container
		Promise.join(
			docker.containerRootDir(appName, deviceIp, DEVICE_SSH_PORT)
			docker.isBalena()
			(containerRootDirLocation, isBalena) ->

				rsyncDestination = path.join(containerRootDirLocation, destination)

				if isBalena
					pidFile = '/var/run/balena.pid'
				else
					pidFile = '/var/run/docker.pid'

				syncOptions =
					username: 'root'
					host: deviceIp
					port: DEVICE_SSH_PORT
					progress: progress
					ignore: ignore
					skipGitignore: skipGitignore
					verbose: verbose
					source: baseDir
					destination: shellwords.escape(rsyncDestination)
					rsyncPath: "mkdir -p \"#{rsyncDestination}\" && nsenter --target $(cat #{pidFile}) --mount rsync"

				command = buildRsyncCommand(syncOptions)

				docker.checkForRunningContainer(appName)
				.then (isContainerRunning) ->
					if not isContainerRunning
						throw new Error("Container must be running before attempting 'sync' action")

					new SpinnerPromise
						promise: shell.runCommand(command, baseDir)
						startMessage: "Syncing to #{destination} on '#{appName}'..."
						stopMessage: "Synced #{destination} on '#{appName}'."
		)
		.then -> # restart container
			stopContainerSpinner(docker.stopContainer(appName))
		.then ->
			startContainerSpinner(docker.startContainer(appName))
		.then -> # run 'after' action
			if after?
				shell.runCommand(after, baseDir)
		.catch (err) ->
			# Notify the user of the error and run 'startApplication()'
			# once again to make sure that a new app container will be started
			startContainerAfterErrorSpinner(docker.startContainer(appName))
			.catch (err) ->
				console.log('Could not start application container', err)
			.finally ->
				throw err
