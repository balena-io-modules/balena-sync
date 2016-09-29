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

fs = require('fs')
path = require('path')
Promise = require('bluebird')
_ = require('lodash')
revalidator = require('revalidator')
Spinner = require('resin-cli-visuals').Spinner
form = require('resin-cli-form')
{ load } = require('./config')

###*
# @summary Validate object
# @function
# @protected
#
# @param {Object} object - input object
# @param {Object} rules - validation rules
#
# @throws Will throw if object is invalid
#
# @example
# utils.validateObject
# 	foo: 'bar'
# ,
# 	properties:
# 		foo:
# 			description: 'foo'
# 			type: 'string'
# 			required: true
###
exports.validateObject = (object, rules) ->
	validation = revalidator.validate(object, rules)

	if not validation.valid
		error = _.first(validation.errors)
		throw new Error(error.message)

unescapeSpaces = (pattern) ->
	pattern = _.trimStart(pattern)

	# Trailing spaces not quoted with backslash are trimmed
	quotedTrailSpacesReg = /(.*\\\s)\s*$/
	if quotedTrailSpacesReg.test(pattern)
		pattern = pattern.match(quotedTrailSpacesReg)[1]
	else
		pattern = _.trimEnd(pattern)

	# Unescape spaces - 'file\ name' and 'file name' are equivalent in .gitignore
	pattern.replace(/\\\s/g, ' ')

###*
# @summary Transform .gitignore patterns to rsync compatible exclude/include patterns
# @function
# @protected
#
# @description Note that in rsync 'include''s must be set before 'exclude''s
#
# @param {String} gitignoreFile - .gitignore file location
#
# @returns object with include/exclude options
# @throws an exception if there was an error accessing the file
#
# @example
# For .gitignore:
# ```
#		node_modules/
#		lib/*
#		!lib/includeme.coffee
# ```
#
# utils.gitignoreToRsync('.gitignore') returns
#
# {
#		include: [ 'lib/includeme.coffee' ]
#		exclude: [ 'node_modules/', 'lib/*' ]
#	}
###
exports.gitignoreToRsyncPatterns = (gitignoreFile) ->
	patterns = fs.readFileSync(gitignoreFile, encoding: 'utf8').split('\n')

	patterns = _.map(patterns, unescapeSpaces)

	# Ignore empty lines and comments
	patterns = _.filter patterns, (pattern) ->
		if pattern.length is 0 or _.startsWith(pattern, '#')
			return false
		return true

	# search for '!'-prefixed patterns to explicitly include
	include = _.chain(patterns).filter (pattern) ->
		_.startsWith(pattern, '!')
	.map (pattern) ->
		pattern.replace(/^!/, '')
	.value()

	# all non '!'-prefixed patterns should be excluded
	exclude = _.chain(patterns).filter (pattern) ->
		not _.startsWith(pattern, '!')
	# Remove escape backslashes
	.map (pattern) ->
		pattern = pattern.replace(/^\\#/, '#')
			.replace(/^\\!/, '!')
	.value()

	return {
		include: _.uniq(include)
		exclude: _.uniq(exclude)
	}

# Resolves with the resolved 'promise' value
exports.spinnerPromise = Promise.method (promise, startMsg, stopMsg) ->

	clearSpinner = (spinner, msg) ->
		spinner.stop() if spinner?
		console.log(msg) if msg?

	spinner = new Spinner(startMsg)
	spinner.start()
	promise.tap (value) ->
		clearSpinner(spinner, stopMsg)
	.catch (err) ->
		clearSpinner(spinner)
		throw err

# Resolves with the resolved 'promise' value
exports.startContainer = (promise) ->
	exports.spinnerPromise(
		promise
		'Starting application container...'
		'Application container started.'
	)

# Resolves with the resolved 'promise' value
exports.stopContainer = (promise) ->
	exports.spinnerPromise(
		promise
		'Stopping application container...'
		'Application container stopped.'
	)

# Resolves with the resolved 'promise' value
exports.startContainerAfterError = (promise) ->
	exports.spinnerPromise(
		promise
		'Attempting to start application container after failed \'sync\'...'
		'Application container started after failed \'sync\'.'
	)

# Get sync options from command line and `.resin-sync.yml`
# Command line options have precedence over the ones saved in `.resin-sync.yml`
exports.getSyncOptions = (options = {}) ->
	Promise.try ->
		try
			if not options.source?
				fs.accessSync(path.join(process.cwd(), '.resin-sync.yml'))
				options.source = process.cwd()
		catch
			throw new Error('No --source option passed and no \'.resin-sync.yml\' file found in current directory.')

		return load(options.source)
	.then	(resinSyncYml) ->
		syncOptions = {}

		# Capitano does not support comma separated options yet
		if options.ignore?
			options.ignore = options.ignore.split(',')

		_.mergeWith syncOptions, resinSyncYml, options, (objVal, srcVal, key) ->
			# Give precedence to command line 'ignore' options
			if key is 'ignore'
				return srcVal

		# Filter out empty 'ignore' paths
		syncOptions.ignore = _.filter(syncOptions.ignore, (item) -> not _.isEmpty(item))

		# Only add default 'ignore' options if user has not explicitly set an empty
		# 'ignore' setting in '.resin-sync.yml'
		if syncOptions.ignore.length is 0 and not resinSyncYml.ignore?
			syncOptions.ignore = [ '.git', 'node_modules/' ]

		form.run [
			message: 'Destination directory on device container [/usr/src/app]'
			name: 'destination'
			type: 'input'
		],
			override:
				destination: syncOptions.destination
		.get('destination')
		.then (destination) ->
			_.assign(syncOptions, destination: destination ? '/usr/src/app')
