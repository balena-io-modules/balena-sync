import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as chalk from 'chalk';
import * as rSemver from 'balena-semver';
import * as sdk from 'balena-sdk';
import * as settings from 'balena-settings-client';
import * as shell from '../shell';
import { SpinnerPromise } from 'resin-cli-visuals';
import { buildRsyncCommand } from '../rsync';
import {
	stopContainerSpinner,
	startContainerSpinner,
	infoContainerSpinner,
	startContainerAfterErrorSpinner,
} from '../utils';
const balena = sdk.fromSharedOptions();

const MIN_HOSTOS_RSYNC = '1.1.4';

const syncContainer = Promise.method(function ({
	baseDir = process.cwd(),
	containerId,
	destination,
	fullUuid,
	ignore,
	port,
	progress,
	skipGitignore,
	username,
	verbose,
}: {
	baseDir?: string;
	containerId: string;
	destination: string;
	fullUuid: string;
	ignore?: string | string[];
	port: number;
	progress: boolean;
	skipGitignore: boolean;
	username: string;
	verbose: boolean;
}) {
	if (containerId == null) {
		throw new Error('No application container found');
	}

	const syncOptions = {
		username,
		host: `ssh.${settings.get('proxyUrl')}`,
		source: baseDir,
		destination,
		ignore,
		skipGitignore,
		verbose,
		port,
		progress,
		extraSshOptions: `${username}@ssh.${settings.get(
			'proxyUrl',
		)} rsync ${fullUuid} ${containerId}`,
	};

	const command = buildRsyncCommand(syncOptions);

	return new SpinnerPromise({
		promise: shell.runCommand(command, baseDir),
		startMessage: `Syncing to ${destination} on ${fullUuid.substring(0, 7)}...`,
		stopMessage: `Synced ${destination} on ${fullUuid.substring(0, 7)}.`,
	});
});

/**
 * @summary Ensure HostOS compatibility
 * @function
 * @private
 *
 * @description
 * Ensures 'rsync' is installed on the target device by checking
 * HostOS version. Fullfills promise if device is compatible or
 * rejects it otherwise. Version checks are based on semver.
 *
 * @param {String} osVersion - HostOS version as returned from the API (device.os_version field)
 * @param {String} minVersion - Minimum accepted HostOS version
 * @returns {Promise}
 *
 * @example
 * ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC)
 * .then(() =>
 *   console.log('Is compatible')
 * )
 * .catch(() =>
 *   console.log('Is incompatible')
 * )
 */
const ensureHostOSCompatibility = Promise.method(function (
	osVersion: string | null,
	minVersion: string,
) {
	if (rSemver.valid(osVersion) == null) {
		throw new Error(
			`Could not parse semantic version from HostOS release info: ${osVersion}`,
		);
	}

	if (rSemver.lt(osVersion, minVersion)) {
		throw new Error(
			`Incompatible HostOS version: ${osVersion} - must be >= ${minVersion}`,
		);
	}
});

// Resolves with uuid, throws on error or if device is offline
export const ensureDeviceIsOnline = (uuid: string) =>
	Promise.resolve(balena.models.device.get(uuid)).then(function (device) {
		if (!device.is_online) {
			throw new Error(`Device is offline: ${uuid}`);
		}
		return uuid;
	});

/**
 * @summary Sync your changes with a device
 * @function
 * @public
 *
 * @description
 * This module provides a way to sync changes from a local source
 * directory to a device. It relies on the following dependencies
 * being installed in the system:
 *
 * - `rsync`
 * - `ssh`
 *
 * You can save all the options mentioned below in a `balena-sync.yml`
 * file, by using the same option names as keys. For example:
 *
 * 	$ cat $PWD/balena-sync.yml
 * 	destination: '/usr/src/app/'
 * 	before: 'echo Hello'
 * 	after: 'echo Done'
 * 	port: 22
 * 	ignore:
 * 		- .git
 * 		- node_modules/
 *
 * Notice that explicitly passed command options override the ones
 * set in the configuration file.
 *
 * @param {Object} [syncOptions] - cli options
 * @param {String} [syncOptions.uuid] - device uuid
 * @param {String} [syncOptions.baseDir] - project base dir
 * @param {String} [syncOptions.destination=/usr/src/app] - destination directory on device
 * @param {String} [syncOptions.before] - command to execute before sync
 * @param {String} [syncOptions.after] - command to execute after sync
 * @param {String[]} [syncOptions.ignore] - ignore paths
 * @param {Number} [syncOptions.port=22] - ssh port
 * @param {Boolean} [syncOptions.skipGitignore=false] - skip .gitignore when parsing exclude/include files
 * @param {Boolean} [syncOptions.skipRestart=false] - do not restart container after sync
 * @param {Boolean} [syncOptions.progress=false] - display rsync progress
 * @param {Boolean} [syncOptions.verbose=false] - display verbose info
 *
 * @example
 * sync({
 *   uuid: '7a4e3dc',
 *   baseDir: '.',
 *   destination: '/usr/src/app',
 *   ignore: [ '.git', 'node_modules' ],
 *   progress: false
 * });
 */
export const sync = function ({
	after,
	baseDir,
	before,
	destination,
	ignore,
	port = 22,
	progress = false,
	skipGitignore = false,
	skipRestart = false,
	uuid,
	verbose = false,
}: {
	after?: string;
	baseDir?: string;
	before?: string;
	destination?: string;
	ignore?: string | string[];
	port?: number;
	progress?: boolean;
	skipGitignore?: boolean;
	skipRestart?: boolean;
	uuid?: string;
	verbose?: boolean;
} = {}) {
	if (destination == null) {
		throw new Error("'destination' is a required sync option");
	}
	if (uuid == null) {
		throw new Error("'uuid' is a required sync option");
	}
	if (baseDir == null) {
		throw new Error("'baseDir' is a required sync option");
	}

	// Resolves with object with required device info or is rejected if API was not accessible. Resolved object:
	//
	// {
	//   fullUuid: <string, full balena device UUID>
	//  }
	const getDeviceInfo = function (deviceUuid: string) {
		const RequiredDeviceObjectFields = ['uuid', 'os_version'];

		// Returns a promise that is resolved with the API-fetched device object or rejected on error or missing requirement
		const ensureDeviceRequirements = (device: sdk.Device) =>
			ensureHostOSCompatibility(device.os_version, MIN_HOSTOS_RSYNC).then(
				function () {
					const missingKeys = _.difference(
						RequiredDeviceObjectFields,
						_.keys(device),
					);
					if (missingKeys.length > 0) {
						throw new Error(
							`Fetched device info is missing required fields '${missingKeys.join(
								"', '",
							)}'`,
						);
					}

					return device;
				},
			);

		console.info(`Getting information for device: ${deviceUuid}`);

		return Promise.resolve(balena.models.device.get(deviceUuid))
			.tap(function (device) {
				if (!device.is_online) {
					throw new Error('Device is not online');
				}
			})
			.then(ensureDeviceRequirements) // Fail early if 'balena sync'-specific requirements are not met
			.then((result) => ({
				fullUuid: result.uuid,
			}));
	};

	return Promise.props({
		fullUuid: getDeviceInfo(uuid).get('fullUuid'),
		username: balena.auth.whoami(),
	})
		.tap(function () {
			// run 'before' action
			if (before != null) {
				return shell.runCommand(before, baseDir);
			}
		})
		.then(
			(
				{ fullUuid, username }, // the resolved 'containerId' value is needed for the rsync process over balena-proxy
			) =>
				infoContainerSpinner(
					balena.models.device.getApplicationInfo(fullUuid),
				).then(
					(
						{ containerId }: { containerId: string }, // sync container
					) =>
						syncContainer({
							baseDir,
							containerId,
							destination,
							fullUuid,
							ignore,
							port,
							progress,
							skipGitignore,
							username: username!,
							verbose,
						})
							.then(function () {
								if (skipRestart === false) {
									// There is a `restartApplication()` sdk method that we can't use
									// at the moment, because it always removes the original container,
									// which results in `balena sync` changes getting lost.
									return stopContainerSpinner(
										balena.models.device.stopApplication(fullUuid),
									).then(() =>
										startContainerSpinner(
											balena.models.device.startApplication(fullUuid),
										),
									);
								}
							})
							.then(function () {
								// run 'after' action
								if (after != null) {
									return shell.runCommand(after, baseDir);
								}
							})
							.then(() =>
								console.log(
									chalk.green.bold('\nbalena sync completed successfully!'),
								),
							)
							.catch(
								(
									err, // Notify the user of the error and run 'startApplication()'
								) =>
									// once again to make sure that a new app container will be started
									startContainerAfterErrorSpinner(
										balena.models.device.startApplication(fullUuid),
									)
										.catch((startErr: any) =>
											console.log(
												'Could not start application container',
												startErr,
											),
										)
										.throw(err),
							),
				),
		)
		.catch(function (err) {
			console.log(chalk.red.bold('balena sync failed.', err));
			throw err;
		});
};
