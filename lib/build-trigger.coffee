###*
# Helper methods for build-trigger `balena local push` feature
# @module build-trigger
###

fs = require('fs')
path = require('path')
crypto = require('crypto')
Promise = require('bluebird')
_ = require('lodash')
TypedError = require('typed-error')
{ fileExists } = require('./utils')

class FileChangedError extends TypedError

###*
# @summary Return file hash - based on https://nodejs.org/api/crypto.html
# @function getFileHash
#
# @param {String} file - file path
# @param {String} [algo='sha256'] - Hash algorithm
#
# @returns {Promise}
# @throws Exception on error
#
# @example
# getFileHash('package.json').then (hash) ->
#		console.log('hash')
###
exports.getFileHash = getFileHash = Promise.method (file, algo = 'sha256') ->
	new Promise (resolve, reject) ->
		try
			hash = crypto.createHash(algo)
			input = fs.createReadStream(file)
			input.on 'readable', ->
				data = input.read()
				if data?
					return hash.update(data)
				return resolve(hash.digest('hex'))
			.on('error', reject)
		catch err
			reject(err)

###*
# @summary Creates an array of objects with the hashes of the passed files
# @function
#
# @param {Object} options - options
# @param {String[]} [options.files=[]] - array of file paths to calculate hashes
# @param {String} [options.baseDir=process.cwd()] - Base directory for relative file paths
# @param {Boolean} [options.skipMissing=true] - Skip non-existent files from the 'files' array
#
# @returns {Promise}
# @throws Exception on error or if 'skipMissing' is false and a file in the 'files' array does not exis
#
# @example
# createBuildTriggerHashes({ files: [ 'package.json', 'Dockerfile' ] }).then (hashes) ->
# // resolves with 'hashes' array:
# [
#		{ 'package.json': <sha256> }
#		{ 'Dockerfile': <sha256> }
#	]
#
###
module.exports.createBuildTriggerHashes = Promise.method ({ files = [], baseDir = process.cwd(), skipMissing = true }) ->
	# Dockerfile and package.json are always included as build triggers
	buildTriggers = _.union(files, [ 'Dockerfile', 'package.json' ])

	buildTriggers = _.chain(buildTriggers)
		.filter (filename) ->
			# Filter out empty 'build-triggers' file names (e.g. when passing 'package.json,,,trigger.txt')
			not _.isEmpty(filename)
		.map (filename) ->
			return filename.trim()
		.map (filename) ->
			# return full path to easily remove duplicates
			if not path.isAbsolute(filename)
				return path.join(baseDir, filename)
			return filename
		.uniq()
		.filter (filename) ->
			if not fileExists(filename)
				throw new Error("Could not calculate hash - File does not exist: #{filename}") if not skipMissing
				return false
			return true
		.map (filename) ->
			# We prefer to save relative file paths in the yaml config so that the paths will still be valid
			# if the yaml config (i.e. `balena-sync.yml`) is checked into a git repo and then cloned to another
			# workstation
			path.relative(baseDir, filename)
		.value()

	Promise.map buildTriggers, (filename) ->
		getFileHash(path.join(baseDir, filename))
		.then (hash) ->
			result = {}
			result[filename] = hash

			return result

###*
# @summary Checks if any of the files in the build trigger list has changed or is missing
# @function checkTriggers
#
# @param {Object} buildTriggers - Array of { filePath: hash } objects
# @param {String} [baseDir=process.cwd()] - Base directory for relative file paths in 'buildTriggers'
#
# @returns {Promise} - Resolves with true if any file hash has changed or any of the files was missing,
# false otherwise
# @throws Exception on error
#
# @example
# checkTriggers('package.json': 1234, 'Dockerfile': 5678).then (triggered) ->
#		console.log(triggered)
###
module.exports.checkTriggers = Promise.method (buildTriggers, baseDir = process.cwd()) ->
	if _.isEmpty(buildTriggers)
		return false

	Promise.map buildTriggers, (trigger) ->
		[ filename, saved_hash ] = _.toPairs(trigger)[0]

		filename = path.join(baseDir, filename)

		if not fileExists(filename)
			throw new FileChangedError('File missing:', filename)

		getFileHash(filename)
		.then (hash) ->
			if hash isnt saved_hash
				throw new FileChangedError('File changed:', filename)
	.then ->
		return false
	.catch FileChangedError, (err) ->
		return true
	.catch (err) ->
		console.log('[Warning] Error while checking build trigger hashes', err?.message ? err)
		return true
