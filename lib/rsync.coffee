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

_ = require('lodash')
_.str = require('underscore.string')
rsync = require('rsync')
settings = require('resin-settings-client')
utils = require('./utils')
ssh = require('./ssh')

###*
# @summary Get rsync command
# @function
# @protected
#
# @param {Object} options - rsync options
# @param {String} options.username - username
# @param {String} options.uuid - device uuid
# @param {String} options.containerId - container id
# @param {Boolean} [options.progress] - show progress
# @param {String|String[]} [options.ignore] - pattern/s to ignore
# @param {Number} [options.port=22] - ssh port
#
# @returns {String} rsync command
#
# @example
# command = rsync.getCommand
#		username: 'test',
#		uuid: '1324'
#		containerId: '6789'
###
exports.getCommand = (options = {}) ->

	utils.validateObject options,
		properties:
			username:
				description: 'username'
				type: 'string'
				required: true
				messages:
					type: 'Not a string: username'
					required: 'Missing username'
			progress:
				description: 'progress'
				type: 'boolean'
				message: 'Not a boolean: progress'
			ignore:
				description: 'ignore'
				type: [ 'string', 'array' ]
				message: 'Not a string or array: ignore'

	{ username } = options
	args =
		source: '.'
		destination: "#{username}@ssh.#{settings.get('proxyUrl')}:"
		progress: options.progress
		shell: ssh.getConnectCommand(options)

		# a = archive mode.
		# This makes sure rsync synchronizes the
		# files, and not just copies them blindly.
		#
		# z = compress during transfer
		flags: 'az'

	# For some reason, adding `exclude: undefined` adds an `--exclude`
	# with nothing in it right before the source, which makes rsync
	# think that we want to ignore the source instead of transfer it.
	if options.ignore?
		args.exclude = options.ignore

	result = rsync.build(args).command()

	# Workaround to the fact that node-rsync duplicates
	# backslashes on Windows for some reason.
	result = result.replace(/\\\\/g, '\\')

	return result
