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
revalidator = require('revalidator')
path = require('path')
rsync = require('rsync')
utils = require('./utils')
ssh = require('./ssh')

###*
# @summary Get rsync command
# @function
# @protected
#
# @param {String} uuid - uuid
# @param {Object} options - rsync options
# @param {String} options.source - source path
# @param {Boolean} [options.progress] - show progress
# @param {String|String[]} [options.ignore] - pattern/s to ignore
#
# @returns {String} rsync command
#
# @example
# command = rsync.getCommand '...',
# 	source: 'foo/bar'
# 	uuid: '1234567890'
###
exports.getCommand = (uuid, options = {}) ->

	utils.validateObject options,
		properties:
			source:
				description: 'source'
				type: 'string'
				required: true
				messages:
					type: 'Not a string: source'
					required: 'Missing source'
			progress:
				description: 'progress'
				type: 'boolean'
				message: 'Not a boolean: progress'
			ignore:
				description: 'ignore'
				type: [ 'string', 'array' ]
				message: 'Not a string or array: ignore'

	# A trailing slash on the source avoids creating
	# an additional directory level at the destination.
	if not _.str.isBlank(options.source) and _.last(options.source) isnt '/'
		options.source += '/'

	args =
		source: options.source
		destination: "root@#{uuid}.resin:/data/.resin-watch"
		progress: options.progress
		shell: ssh.getConnectCommand(options)

		# a = archive mode.
		# This makes sure rsync synchronizes the
		# files, and not just copies them blindly.
		#
		# z = compress during transfer
		# r = recursive
		flags: 'azr'

	if _.isEmpty(options.source.trim())
		args.source = '.'

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
