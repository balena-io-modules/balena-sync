path = require('path')
_ = require('lodash')
yamlConfig = require('../yaml-config')
{ fileExists, validateEnvVar } = require('../utils')

defaultSyncIgnorePaths = [ '.git', 'node_modules/' ]

###*
# @summary Parse balena sync options from the cli and config file and give precedence to the cli.
# @function
#
# @param {Object} cliOptions - options
# @param {String} cliParams - parameters
#
# @returns {Object} parsedOptions
# @returns {Object} parsedOptions.configYml - the loaded config file (i.e. 'balena-sync.yml')
# @returns {Object} parsedOptions.options - the parsed options
# @throws Exception on error
#
###
module.exports = (cliOptions = {}, cliParams = {}) ->

	# The project base directory is either the current working directory or the directory passed by
	# the user with the '--source/-s' option
	projectBaseDir = if cliOptions['source']
		path.resolve(cliOptions['source'])
	else
		process.cwd()

	if not cliOptions['source']? and not fileExists(path.join(process.cwd(), yamlConfig.CONFIG_FILE))
		throw new Error("No --source option passed and no \'#{yamlConfig.CONFIG_FILE}\' file found in current directory.")

	# The yaml-as-JS-object variable to hold CONFIG_FILE (currently '.balena-sync.yml') contents
	configYml = yamlConfig.load(projectBaseDir)
	configYml['local_balenaos'] ?= {}

	# Capitano does not support comma separated options yet
	if cliOptions['build-triggers']?
		cliOptions['build-triggers'] = cliOptions['build-triggers'].split(',')

	# Parse build trigger files and their hashes from the config file
	savedBuildTriggers = configYml['local_balenaos']['build-triggers'] ? []
	savedBuildTriggerFiles = _.flatten(file for file of trigger for trigger in savedBuildTriggers)

	# Ditto on capitano comma separated options
	if cliOptions['ignore']?
		cliOptions['ignore'] = cliOptions['ignore'].split(',')

	ignoreFiles = cliOptions['ignore'] ? configYml['ignore'] ? defaultSyncIgnorePaths

	# Filter out empty 'ignore' paths
	ignoreFiles = _.filter(ignoreFiles, (item) -> not _.isEmpty(item))

	# Return parsed options and give precedence to command line options
	# in favor of the ones saved in the config file
	return {
		configYml: configYml
		runtimeOptions:
			baseDir: projectBaseDir
			deviceIp: cliParams['deviceIp']
			appName: cliOptions['app-name'] ? configYml['local_balenaos']['app-name']
			destination: cliOptions['destination'] ? configYml['destination']
			before: cliOptions['before'] ? configYml['before']
			after: cliOptions['after'] ? configYml['after']
			progress: cliOptions['progress'] ? false
			verbose: cliOptions['verbose'] ? false
			skipRestart: cliOptions['skip-restart'] ? false
			skipGitignore: cliOptions['skip-gitignore'] ? false
			ignore: ignoreFiles
			skipLogs: cliOptions['skip-logs'] ? false
			forceBuild: cliOptions['force-build'] ? false
			buildTriggerFiles: cliOptions['build-triggers'] ? savedBuildTriggerFiles
			savedBuildTriggerFiles: savedBuildTriggerFiles
			uuid: cliParams['uuid']
			port: cliOptions['port'] ? configYml['port']
			env: validateEnvVar(cliOptions['env'] ? configYml['local_balenaos']['environment'])
	}
