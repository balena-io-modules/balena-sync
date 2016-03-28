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

child_process = require('child_process')
os = require('os')
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

	# Assume Cygwin
	if os.platform() is 'win32'
		return {
			program: 'sh'
			args: [ '-c', command ]
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
# @returns {Promise}
#
# @example
# shell.runCommand('echo hello').then ->
# 	console.log('Done!')
###
exports.runCommand = (command) ->
	subShellCommand = exports.getSubShellCommand(command)
	spawn = child_process.spawn subShellCommand.program, subShellCommand.args,
		stdio: 'inherit'

	return rindle.wait(spawn).spread (code) ->
		return if code is 0
		throw new Error("Child process exited with code #{code}")
