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

child_process = require('child_process')
os = require('os')
Promise = require('bluebird')
_ = require('lodash')
rindle = require('rindle')

###*
# @summary Get sub shell command
# @function
# @protected
#
# @param {String} command - command
# @returns {String} sub shell command
#
# @example
# subShellCommand = shell.getSubShellCommand('foo')
###
exports.getSubShellCommand = (command) ->
	if os.platform() is 'win32'
		return {
			program: 'cmd.exe'
			args: [ '/s', '/c', command ]
		}
	else
		return {
			program: '/bin/sh'
			args: [ '-c', command ]
		}

###*
# @summary Run a command in a subshell
# @function
# @protected
#
# @description
# stdin is inherited from the parent process.
#
# @param {String} command - command
# @param {String} cwd - current working directory
# @returns {Promise}
#
# @example
# shell.runCommand('echo hello').then ->
# 	console.log('Done!')
###
exports.runCommand = Promise.method (command, cwd) ->
	env = {}

	if os.platform() is 'win32'

		# Under Windows, openssh attempts to read SSH keys from
		# `/home/<username>`, however this makes no sense in Windows.
		# As a workaround, we can set the %HOME% environment variable
		# to `/<home drive letter>/Users/<user>` to trick openssh
		# to read ssh keys from `<home drive letter>:\Users\<user>\.ssh`
		homedrive = _.get(process, 'env.homedrive', 'C:').slice(0, 1).toLowerCase()
		homepath = _.get(process, 'env.homepath', '').replace(/\\/g, '/')
		env.HOME = "/#{homedrive}#{homepath}"

	subShellCommand = exports.getSubShellCommand(command)
	spawn = child_process.spawn subShellCommand.program, subShellCommand.args,
		stdio: 'inherit'
		env: _.merge(env, process.env)
		cwd: cwd

		# This is an internal undocumented option that causes
		# spawn to execute multiple word commands correctly
		# on Windows when passing them to `cmd.exe`
		# See https://github.com/nodejs/node-v0.x-archive/issues/2318#issuecomment-3220048
		windowsVerbatimArguments: true

	return rindle.wait(spawn).spread (code) ->
		return if code is 0
		throw new Error("Child process exited with code #{code}")
