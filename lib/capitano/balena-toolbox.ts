export default {
	signature: 'push [deviceIp]',
	description: 'Push your changes to a container on local balenaOS device ',
	help: `\
Warning: 'balena local push' requires an openssh-compatible client and 'rsync' to
be correctly installed in your shell environment. For more information (including
Windows support) please check the README here: https://github.com/balena-io/balena-cli

Use this command to push your local changes to a container on a LAN-accessible balenaOS device on the fly.

If \`Dockerfile\` or any file in the 'build-triggers' list is changed, a new container will be built and run on your device.
If not, changes will simply be synced with \`rsync\` into the application container.

After every 'balena local push' the updated settings will be saved in
'<source>/.balena-sync.yml' and will be used in later invocations. You can
also change any option by editing '.balena-sync.yml' directly.

Here is an example '.balena-sync.yml' :

	$ cat $PWD/.balena-sync.yml
	destination: '/usr/src/app'
	before: 'echo Hello'
	after: 'echo Done'
	ignore:
		- .git
		- node_modules/

Command line options have precedence over the ones saved in '.balena-sync.yml'.

If '.gitignore' is found in the source directory then all explicitly listed files will be
excluded when using rsync to update the container. You can choose to change this default behavior with the
'--skip-gitignore' option.

Examples:

	$ balena local push
	$ balena local push --app-name test-server --build-triggers package.json,requirements.txt
	$ balena local push --force-build
	$ balena local push --force-build --skip-logs
	$ balena local push --ignore lib/
	$ balena local push --verbose false
	$ balena local push 192.168.2.10 --source . --destination /usr/src/app
	$ balena local push 192.168.2.10 -s /home/user/myBalenaProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'\
`,
	primary: true,
	options: [
		{
			signature: 'source',
			parameter: 'path',
			description: 'root of project directory to push',
			alias: 's',
		},
		{
			signature: 'destination',
			parameter: 'path',
			description: 'destination path on device container',
			alias: 'd',
		},
		{
			signature: 'ignore',
			parameter: 'paths',
			description: "comma delimited paths to ignore when syncing with 'rsync'",
			alias: 'i',
		},
		{
			signature: 'skip-gitignore',
			boolean: true,
			description: 'do not parse excluded/included files from .gitignore',
		},
		{
			signature: 'before',
			parameter: 'command',
			description: 'execute a command before pushing',
			alias: 'b',
		},
		{
			signature: 'after',
			parameter: 'command',
			description: 'execute a command after pushing',
			alias: 'a',
		},
		{
			signature: 'progress',
			boolean: true,
			description: 'show progress',
			alias: 'p',
		},
		{
			signature: 'skip-logs',
			boolean: true,
			description: 'do not stream logs after push',
		},
		{
			signature: 'verbose',
			boolean: true,
			description: 'increase verbosity',
			alias: 'v',
		},
		{
			signature: 'app-name',
			parameter: 'name',
			description:
				'application name - may contain lowercase characters, digits and one or more dashes. It may not start or end with a dash.',
			alias: 'n',
		},
		{
			signature: 'build-triggers',
			parameter: 'files',
			description:
				'comma delimited file list that will trigger a container rebuild if changed',
			alias: 'r',
		},
		{
			signature: 'force-build',
			boolean: true,
			description: 'force a container build and run',
			alias: 'f',
		},
		{
			signature: 'env',
			parameter: 'env',
			description:
				"environment variable (e.g. --env 'ENV=value'). Multiple --env parameters are supported.",
			alias: 'e',
		},
	],
	action(params: any, options: { [x: string]: any }, done: any) {
		const path = require('path');
		const Promise = require('bluebird');
		const _ = require('lodash');
		const chalk = require('chalk');
		const yamlConfig = require('../yaml-config');
		const parseOptions = require('./parse-options');
		const DockerUtils = require('../docker-utils');
		const {
			selectSyncDestination,
			selectLocalBalenaOsDevice,
		} = require('../forms');
		const { fileExists } = require('../utils');
		const { sync } = require('../sync')('local-balena-os-device');
		const {
			createBuildTriggerHashes,
			checkTriggers,
		} = require('../build-trigger');

		/**
		 * @summary Start image-building 'balena local push' process
		 * @function build
		 *
		 * @param {Object} options - options
		 * @param {String} options.appName - Application image (i.e. image & container name)
		 * @param {String} options.deviceIp - Device ip or host
		 * @param {String} [options.baseDir=process.cwd()] - Project base directory that also containers Dockerfile
		 *
		 * @returns {void} - Exits process with 0 on success or 1 otherwise
		 * @throws Exception on error
		 *
		 * @example
		 * build(appName: 'test', deviceIp: '192.168.1.1')
		 */
		const build = function ({
			appName,
			deviceIp,
			env = [],
			baseDir = process.cwd(),
		}: {
			appName?: string;
			deviceIp?: string;
			env?: string[];
			baseDir?: string;
		} = {}) {
			if (appName == null) {
				throw new Error("Missing application name for 'balena push'");
			}
			if (deviceIp == null) {
				throw new Error("Missing device ip/host for 'balena push'");
			}

			const docker = new DockerUtils(deviceIp);

			console.log(chalk.yellow.bold('* Building..'));

			console.log(
				`- Stopping and removing any previous '${appName}' container`,
			);

			return Promise.all([
				docker
					.stopContainer(appName)
					.then(() => docker.removeContainer(appName)),
				// Get existing image id, to remove it after building new one to preserve build cache
				docker
					.inspectImage(appName)
					.catch(function (err: { statusCode: string }) {
						const statusCode = '' + err.statusCode;
						if (statusCode === '404') {
							return null;
						}
						throw err;
					}),
				// Get all image ids, to add them as extra possible cache sources
				docker.getAllImages().map((image: { Id: any }) => image.Id),
			])
				.spread(function (
					__: any,
					oldImageInfo: { Id: any } | null,
					existingImageIds: any,
				) {
					console.log('- Uploading build context & starting build...');
					return docker
						.buildImage({
							baseDir,
							name: appName,
							outStream: process.stdout,
							cacheFrom: existingImageIds,
						})
						.then(() =>
							// Clean up previous image only if new build resulted in different image hash
							docker.inspectImage(appName),
						)
						.then(function (newImageInfo: { Id: any }) {
							if (oldImageInfo != null && oldImageInfo.Id !== newImageInfo.Id) {
								console.log(`- Cleaning up previous image of '${appName}'`);
								return docker.removeImage(oldImageInfo.Id);
							}
						});
				})
				.then(function () {
					console.log(`- Creating '${appName}' container`);
					return docker.createContainer(appName, { env });
				})
				.then(function () {
					console.log(`- Starting '${appName}' container`);
					return docker.startContainer(appName);
				});
		};

		// Parse cli options and parameters
		const { runtimeOptions, configYml } = parseOptions(options, params);

		if (!fileExists(path.join(runtimeOptions.baseDir, 'Dockerfile'))) {
			if (
				fileExists(path.join(runtimeOptions.baseDir, 'Dockerfile.template'))
			) {
				throw new Error(`Dockerfile.template files are not yet supported by local push. \
\
\n\nAs a workaround, you can rename your \'Dockerfile.template\' to \'Dockerfile\', \
and replace all %%TEMPLATE%% strings with the appropriate values, as documented in \
https://balena.io/docs/learn/develop/dockerfile/#dockerfile-templates. For example \'%%RESIN_MACHINE_NAME%%\' \
would become \'raspberrypi3\' on a Raspberry Pi 3 device. \
\
\n\nSubscribe to https://github.com/balena-io/balena-cli/issues/604 for updates.`);
			} else {
				throw new Error(
					`No Dockerfile found in the project directory: ${runtimeOptions.baseDir}`,
				);
			}
		}

		return Promise.try(() =>
			// Get device Ip and app name, giving precedence to the cli param
			runtimeOptions.deviceIp != null
				? runtimeOptions.deviceIp
				: selectLocalBalenaOsDevice(),
		)
			.then(function (deviceIp: any) {
				const appName =
					runtimeOptions.appName != null ? runtimeOptions.appName : 'local-app';

				// Update runtime options and soon-to-be-saved config file object based on user choices
				runtimeOptions.deviceIp = deviceIp;
				runtimeOptions.appName = appName;
				configYml['local_balenaos']['app-name'] = appName;

				const docker = new DockerUtils(deviceIp);

				// The project should be rebuilt if any of the following is true:
				// 		- The saved build trigger list in yamlConfig is empty or the cli 'build-trigger' option was set
				// 		- The 'force-build' cli option was set
				// 		- Any of the saved build trigger files is modified
				// 		- The application image does not exist or the container is not running
				const configYmlBuildTriggers =
					configYml['local_balenaos']['build-triggers'];
				return Promise.reduce(
					[
						_.isEmpty(configYmlBuildTriggers) ||
							!_.isEmpty(options['build-triggers']),
						runtimeOptions.forceBuild,
						checkTriggers(configYmlBuildTriggers),
						docker
							.checkForExistingImage(appName)
							.then((exists: any) => !exists), // return 'true' if image does not exist
						docker
							.checkForRunningContainer(appName)
							.then((isRunning: any) => !isRunning), // return 'true' if container is not running
					],
					(shouldRebuild: any, result: any) => shouldRebuild || result,
					false,
				)
					.then(function (shouldRebuild: any) {
						if (shouldRebuild) {
							// Calculate new hashes
							return createBuildTriggerHashes({
								baseDir: runtimeOptions.baseDir,
								files: runtimeOptions.buildTriggerFiles,
							}).then(function (buildTriggerHashes: any) {
								// Options to save in yamlConfig
								configYml['local_balenaos']['build-triggers'] =
									buildTriggerHashes;
								configYml['local_balenaos']['environment'] = runtimeOptions.env;

								// Save config file before starting build
								yamlConfig.save(configYml, runtimeOptions.baseDir);

								return build(
									_.pick(runtimeOptions, [
										'baseDir',
										'deviceIp',
										'appName',
										'env',
									]),
								);
							});
						} else {
							console.log(chalk.yellow.bold('* Syncing..'));
							return selectSyncDestination(runtimeOptions.destination).then(
								function (destination: any) {
									// Update runtime options based on user choices
									runtimeOptions.destination = destination;

									// Save config file before starting sync
									const notNil = (val: any) => !_.isNil(val);
									yamlConfig.save(
										_.assign(
											{},
											configYml,
											_(runtimeOptions)
												.pick(['destination', 'ignore', 'before', 'after'])
												.pickBy(notNil)
												.value(),
										),
										runtimeOptions.baseDir,
									);

									return sync(
										_.pick(runtimeOptions, [
											'baseDir',
											'deviceIp',
											'appName',
											'destination',
											'before',
											'after',
											'progress',
											'verbose',
											'skipGitignore',
											'ignore',
										]),
									);
								},
							);
						}
					})
					.then(() =>
						console.log(chalk.green.bold('\nPush completed successfully!')),
					)
					.catch(function (err: { stack: any }) {
						console.log(chalk.red.bold('Push failed.', err, err.stack));
						return process.exit(1);
					})
					.then(function () {
						if (runtimeOptions.skipLogs === true) {
							return process.exit(0);
						}

						console.log(chalk.yellow.bold('* Streaming application logs..'));
						return docker
							.followContainerLogs(appName)
							.catch(function (err: any) {
								console.log('[Info] Could not stream logs from container', err);
								return process.exit(0);
							});
					});
			})
			.nodeify(done);
	},
};
