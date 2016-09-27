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
revalidator = require('revalidator')
form = require('resin-cli-form')
resin = require('resin-sdk')

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
	fs = require('fs')

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

exports.selectResinIODevice = (preferredUuid) ->
	resin.models.device.getAll()
	.filter (device) ->
		device.is_online
	.then (onlineDevices) ->
		if _.isEmpty(onlineDevices)
			throw new Error('You don\'t have any devices online')

		return form.ask
			message: 'Select a device'
			type: 'list'
			default: if preferredUuid in _.map(onlineDevices, 'uuid') then preferredUuid else onlineDevices[0].uuid
			choices: _.map onlineDevices, (device) ->
				return {
					name: "#{device.name or 'Untitled'} (#{device.uuid.slice(0, 7)})"
					value: device.uuid
				}
