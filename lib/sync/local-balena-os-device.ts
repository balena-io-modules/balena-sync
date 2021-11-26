import * as path from 'path';
import * as Promise from 'bluebird';
import * as shellwords from 'shellwords';
import * as shell from '../shell';
import { DockerUtils } from '../docker-utils';
import { SpinnerPromise } from 'resin-cli-visuals';
import { buildRsyncCommand } from '../rsync';
import {
	startContainerSpinner,
	stopContainerSpinner,
	startContainerAfterErrorSpinner,
} from '../utils';

const DEVICE_SSH_PORT = 22222;

/**
 * @summary Run rsync on a local balenaOS device
 * @function sync
 *
 * @param {Object} options - options
 * @param {String} options.deviceIp - Destination device ip/host
 * @param {String} options.baseDir - Project base dir
 * @param {String} options.appName - Application container name
 * @param {String} options.destination - Sync destination folder in container
 * @param {String} [options.before] - Action to execute locally before sync
 * @param {String} [options.after] - Action to execute locally after sync
 * @param {String} [options.progress=false] - Show progress
 * @param {String} [options.verbose=false] - Show progress
 * @param {String} [options.skipGitignore=false] - Skip .gitignore parsing
 * @param {String} [options.ignore] - rsync ignore list
 *
 * @returns {}
 * @throws Exception on error
 *
 * @example
 * sync()
 */
export const sync = function ({
	deviceIp,
	baseDir,
	appName,
	destination,
	before,
	after,
	progress = false,
	verbose = false,
	skipGitignore = false,
	ignore,
}: {
	deviceIp?: string;
	baseDir?: string;
	appName?: string;
	destination?: string;
	before?: string;
	after?: string;
	progress?: boolean;
	verbose?: boolean;
	skipGitignore?: boolean;
	ignore?: string | string[];
} = {}) {
	if (destination == null) {
		throw new Error("'destination' is a required sync option");
	}
	if (deviceIp == null) {
		throw new Error("'deviceIp' is a required sync option");
	}
	if (appName == null) {
		throw new Error("'app-name' is a required sync option");
	}
	if (baseDir == null) {
		throw new Error("'baseDir' is a required sync option");
	}

	const docker = new DockerUtils(deviceIp);

	return Promise.try(function () {
		if (before != null) {
			return shell.runCommand(before, baseDir);
		}
	}).then(() =>
		// sync container
		Promise.join(
			docker.containerRootDir(appName, deviceIp, DEVICE_SSH_PORT),
			docker.isBalena(),
			function (containerRootDirLocation, isBalena) {
				let pidFile;
				const rsyncDestination = path.join(
					containerRootDirLocation,
					destination,
				);

				if (isBalena) {
					pidFile = '/var/run/balena.pid';
				} else {
					pidFile = '/var/run/docker.pid';
				}

				const syncOptions = {
					username: 'root',
					host: deviceIp,
					port: DEVICE_SSH_PORT,
					progress,
					ignore,
					skipGitignore,
					verbose,
					source: baseDir,
					destination: shellwords.escape(rsyncDestination),
					rsyncPath: `mkdir -p \"${rsyncDestination}\" && nsenter --target $(cat ${pidFile}) --mount rsync`,
				};

				const command = buildRsyncCommand(syncOptions);

				return docker
					.checkForRunningContainer(appName)
					.then(function (isContainerRunning) {
						if (!isContainerRunning) {
							throw new Error(
								"Container must be running before attempting 'sync' action",
							);
						}

						return new SpinnerPromise({
							promise: shell.runCommand(command, baseDir),
							startMessage: `Syncing to ${destination} on '${appName}'...`,
							stopMessage: `Synced ${destination} on '${appName}'.`,
						});
					});
			},
		)
			.then(() =>
				// restart container
				stopContainerSpinner(docker.stopContainer(appName)),
			)
			.then(() => startContainerSpinner(docker.startContainer(appName)))
			.then(function () {
				// run 'after' action
				if (after != null) {
					return shell.runCommand(after, baseDir);
				}
			})
			.catch(
				(
					err, // Notify the user of the error and run 'startApplication()'
				) =>
					// once again to make sure that a new app container will be started
					startContainerAfterErrorSpinner(docker.startContainer(appName))
						.catch((startError: any) =>
							console.log('Could not start application container', startError),
						)
						.finally(function () {
							throw err;
						}),
			),
	);
};
