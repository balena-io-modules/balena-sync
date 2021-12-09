import * as path from 'path';
import * as _ from 'lodash';
import * as rsync from 'rsync';
import * as utils from './utils';

const buildRshOption = function (
	options: {
		host?: string;
		verbose?: boolean;
		port?: number;
		extraSshOptions?: string;
	} = {},
) {
	utils.validateObject(options, {
		properties: {
			host: {
				description: 'host',
				type: 'string',
				required: true,
			},
			port: {
				description: 'port',
				type: 'number',
				required: true,
			},
			verbose: {
				description: 'verbose',
				type: 'boolean',
			},
			extraSshOptions: {
				description: 'extraSshOptions',
				type: 'string',
			},
		},
	});

	const verbose = options.verbose ? '-vv ' : '';

	let sshCommand = `\
ssh \
${verbose}\
-p ${options.port} \
-o LogLevel=ERROR \
-o StrictHostKeyChecking=no \
-o UserKnownHostsFile=/dev/null\
`;

	if (options.extraSshOptions != null) {
		sshCommand += ` ${options.extraSshOptions}`;
	}

	return sshCommand;
};

/**
 * @summary Build rsync command
 * @function
 * @protected
 *
 * @param {Object} options - rsync options
 * @param {String} options.username - username
 * @param {String} options.host - host
 * @param {Boolean} [options.progress] - show progress
 * @param {String|String[]} [options.ignore] - pattern/s to ignore. Note that '.gitignore' is always used as a filter if it exists
 * @param {Boolean} [options.skipGitignore] - skip gitignore
 * @param {Boolean} [options.verbose] - verbose output
 * @param {String} options.source - source directory on local machine
 * @param {String} options.destination - destination directory on device
 * @param {String} options.rsyncPath - set --rsync-path rsync option
 *
 * @returns {String} rsync command
 *
 * @example
 * command = rsync.buildRsyncCommand({
 *   host: 'ssh.balena-devices.com'
 *   username: 'test'
 *   source: '/home/user/app',
 *   destination: '/usr/src/app'
 * })
 */
export const buildRsyncCommand = function (
	options: {
		username?: string;
		host?: string;
		progress?: boolean;
		ignore?: string | string[];
		skipGitignore?: boolean;
		verbose?: boolean;
		source?: any;
		destination?: any;
		rsyncPath?: string;
		port?: number;
		extraSshOptions?: string;
	} = {},
) {
	let patterns;
	utils.validateObject(options, {
		properties: {
			username: {
				description: 'username',
				type: 'string',
				required: true,
			},
			host: {
				description: 'host',
				type: 'string',
				required: true,
				messages: {
					type: 'Not a string: host',
					required: 'Missing host',
				},
			},
			progress: {
				description: 'progress',
				type: 'boolean',
				message: 'Not a boolean: progress',
			},
			ignore: {
				description: 'ignore',
				type: ['string', 'array'],
				message: 'Not a string or array: ignore',
			},
			skipGitignore: {
				description: 'skip-gitignore',
				type: 'boolean',
				message: 'Not a boolean: skip-gitignore',
			},
			verbose: {
				description: 'verbose',
				type: 'boolean',
				message: 'Not a boolean: verbose',
			},
			source: {
				description: 'source',
				type: 'any',
				required: true,
				message: 'Not a string: source',
			},
			destination: {
				description: 'destination',
				type: 'any',
				required: true,
				message: 'Not a string: destination',
			},
			rsyncPath: {
				description: 'rsync path',
				type: 'string',
				message: 'Not a string: rsync-path',
			},
		},
	});

	const args = {
		source: '.',
		destination: `${options.username}@${options.host}:${options.destination}`,
		progress: options.progress,
		shell: buildRshOption(options),

		// a = archive mode.
		// This makes sure rsync synchronizes the
		// files, and not just copies them blindly.
		//
		// z = compress during transfer
		// v = increase verbosity
		flags: {
			a: true,
			z: true,
			v: options.verbose,
		},
	};

	// TODO: Fix this any typing once DT types are updated
	// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/57339
	const rsyncCmd = (rsync as any).build(args).delete();

	if (options['rsyncPath'] != null) {
		rsyncCmd.set('rsync-path', options['rsyncPath']);
	}

	if (!options['skipGitignore']) {
		try {
			patterns = utils.gitignoreToRsyncPatterns(
				path.join(options.source, '.gitignore'),
			);

			// rsync 'include' options MUST be set before 'exclude's
			rsyncCmd.include(patterns.include);
			rsyncCmd.exclude(patterns.exclude);
		} catch (error) {
			// intentionally ignore error
		}
	}

	// For some reason, adding `exclude: undefined` adds an `--exclude`
	// with nothing in it right before the source, which makes rsync
	// think that we want to ignore the source instead of transfer it.
	if (options.ignore != null) {
		// Only exclude files that have not already been exlcuded to avoid passing
		// identical '--exclude' options
		const gitignoreExclude = patterns?.exclude ?? [];
		rsyncCmd.exclude(_.difference(options.ignore, gitignoreExclude));
	}

	let result = rsyncCmd.command();

	// Workaround to the fact that node-rsync duplicates
	// backslashes on Windows for some reason.
	result = result.replace(/\\\\/g, '\\');

	if (options.verbose) {
		console.log(`rsync command: ${result}`);
	}

	return result;
};
