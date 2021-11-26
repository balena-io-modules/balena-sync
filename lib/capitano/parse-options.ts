import * as path from 'path';
import * as _ from 'lodash';
import * as yamlConfig from '../yaml-config';
import { fileExists, validateEnvVar } from '../utils';

const defaultSyncIgnorePaths = ['.git', 'node_modules/'];

/**
 * @summary Parse balena sync options from the cli and config file and give precedence to the cli.
 * @function
 *
 * @param {Object} cliOptions - options
 * @param {String} cliParams - parameters
 *
 * @returns {Object} parsedOptions
 * @returns {Object} parsedOptions.configYml - the loaded config file (i.e. 'balena-sync.yml')
 * @returns {Object} parsedOptions.options - the parsed options
 * @throws Exception on error
 *
 */
export default function (
	cliOptions: { [x: string]: any } = {},
	cliParams: { [x: string]: any } = {},
) {
	// The project base directory is either the current working directory or the directory passed by
	// the user with the '--source/-s' option
	const projectBaseDir = cliOptions['source']
		? path.resolve(cliOptions['source'])
		: process.cwd();

	if (
		cliOptions['source'] == null &&
		!fileExists(path.join(process.cwd(), yamlConfig.CONFIG_FILE))
	) {
		throw new Error(
			`No --source option passed and no \'${yamlConfig.CONFIG_FILE}\' file found in current directory.`,
		);
	}

	// The yaml-as-JS-object variable to hold CONFIG_FILE (currently '.balena-sync.yml') contents
	const configYml = yamlConfig.load(projectBaseDir);
	if (configYml['local_balenaos'] == null) {
		configYml['local_balenaos'] = {};
	}

	// Capitano does not support comma separated options yet
	if (cliOptions['build-triggers'] != null) {
		cliOptions['build-triggers'] = cliOptions['build-triggers'].split(',');
	}

	// Parse build trigger files and their hashes from the config file
	const savedBuildTriggers =
		configYml['local_balenaos']['build-triggers'] != null
			? configYml['local_balenaos']['build-triggers']
			: [];
	const savedBuildTriggerFiles = _.flatten(
		savedBuildTriggers.map((trigger: any) => _.keys(trigger)),
	);

	// Ditto on capitano comma separated options
	if (cliOptions['ignore'] != null) {
		cliOptions['ignore'] = cliOptions['ignore'].split(',');
	}

	let ignoreFiles =
		cliOptions.ignore || configYml['ignore'] || defaultSyncIgnorePaths;

	// Filter out empty 'ignore' paths
	ignoreFiles = _.filter(ignoreFiles, (item: any) => !_.isEmpty(item));

	// Return parsed options and give precedence to command line options
	// in favor of the ones saved in the config file
	return {
		configYml,
		runtimeOptions: {
			baseDir: projectBaseDir,
			deviceIp: cliParams['deviceIp'],
			appName:
				cliOptions['app-name'] != null
					? cliOptions['app-name']
					: configYml['local_balenaos']['app-name'],
			destination:
				cliOptions['destination'] != null
					? cliOptions['destination']
					: configYml['destination'],
			before:
				cliOptions['before'] != null
					? cliOptions['before']
					: configYml['before'],
			after:
				cliOptions['after'] != null ? cliOptions['after'] : configYml['after'],
			progress: cliOptions['progress'] != null ? cliOptions['progress'] : false,
			verbose: cliOptions['verbose'] != null ? cliOptions['verbose'] : false,
			skipRestart:
				cliOptions['skip-restart'] != null ? cliOptions['skip-restart'] : false,
			skipGitignore:
				cliOptions['skip-gitignore'] != null
					? cliOptions['skip-gitignore']
					: false,
			ignore: ignoreFiles,
			skipLogs:
				cliOptions['skip-logs'] != null ? cliOptions['skip-logs'] : false,
			forceBuild:
				cliOptions['force-build'] != null ? cliOptions['force-build'] : false,
			buildTriggerFiles:
				cliOptions['build-triggers'] != null
					? cliOptions['build-triggers']
					: savedBuildTriggerFiles,
			savedBuildTriggerFiles,
			uuid: cliParams['uuid'],
			port: cliOptions['port'] != null ? cliOptions['port'] : configYml['port'],
			env: validateEnvVar(
				cliOptions['env'] != null
					? cliOptions['env']
					: configYml['local_balenaos']['environment'],
			),
		},
	};
}
