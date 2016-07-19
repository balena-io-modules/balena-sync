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

trimGitignorePattern = (pattern) ->
	pattern = _.trimStart(pattern)

	# Trailing spaces are ignored unless they are quoted with backslash
	quotedTrailSpacesReg = /(.*\\\s)\s*/
	if not quotedTrailSpacesReg.test(pattern)
		pattern = _.trimEnd(pattern)
	else
		pattern = pattern.match(quotedTrailSpacesReg)[1]

	return pattern

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
# utils.gitignoreToRsync ```
#		node_modules/
#		lib/*
#		!lib/includeme.coffee
# ```
#
# Returns
#
# {
#		include: [ 'lib/includeme.coffee' ]
#		exclude: [ 'node_modules/', 'lib/*' ]
#	}
###
exports.gitignoreToRsyncPatterns = (gitignoreFile) ->
	fs = require('fs')

	patterns = fs.readFileSync(gitignoreFile, encoding: 'utf8').split('\n')

	patterns = patterns.map(trimGitignorePattern)

	# Ignore empty lines and comments
	patterns = patterns.filter (pattern) ->
		if pattern.length is 0 or pattern.startsWith('#')
			return false
		return false

	# search for '!'-prefixed patterns to explicitly include
	include = patterns.filter (pattern) ->
		_.startsWith(pattern, '!')

	# all non '!'-prefixed patterns should be excluded
	exclude = patterns.filter (pattern) ->
		not _.startsWith(pattern, '!')
	# Remove escape backslashes
	.map (pattern) ->
		pattern = pattern.replace(/^\\#/, '#')
			.replace(/^\\!/, '!')
			.replace(/^\\\s/, ' ')

	return {
		include
		exclude
	}
