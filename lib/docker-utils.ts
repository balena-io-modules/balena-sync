import * as fs from 'fs';
import * as path from 'path';
import Docker = require('docker-toolbelt');
import * as Promise from 'bluebird';
import * as JSONStream from 'JSONStream';
import * as tar from 'tar-fs';
import * as ssh2 from 'ssh2';
import * as rSemver from 'balena-semver';
import * as _ from 'lodash';
import { validateEnvVar } from './utils';
import { dockerPort } from './config';
const Ssh2Client = Promise.promisifyAll(ssh2.Client);

// resolved with file contents, rejects on error
const readFileViaSSH = Promise.method(function (
	host: any,
	port: any,
	file: any,
) {
	const getSSHConnection = () =>
		new Promise(function (resolve, reject) {
			const client = new Ssh2Client();
			return client
				.on('ready', () => resolve(client))
				.on('error', function (err) {
					const errSource = (err != null ? err.level : undefined)
						? 'client-socket'
						: 'client-ssh';
					const errMsg = `${errSource} error during SSH connection: ${
						err != null ? err.description : undefined
					}`;
					return reject(new Error(errMsg));
				})
				.connect({
					username: 'root',
					agent: process.env.SSH_AUTH_SOCK,
					host,
					port,
					keepaliveCountMax: 3,
					keepaliveInterval: 10000,
					readyTimeout: 30000,
					tryKeyboard: false,
				});
		}).disposer((client: any) => client.end());

	return Promise.using(getSSHConnection(), (client: typeof Ssh2Client) =>
		(client as any)
			.execAsync(`cat ${file}`)
			.then((stream: ssh2.ClientChannel) =>
				new Promise<{ data: string; code: any; signal: any }>(
					(resolve, reject) => {
						const bufStdout: any[] = [];
						return stream
							.on('data', (chunk: any) => bufStdout.push(chunk))
							.on('close', function (code: any, signal: any) {
								const data = Buffer.concat(bufStdout).toString();
								return resolve({ data, code, signal });
							})
							.on('error', reject);
					},
				)
					.tap(function ({ code }) {
						if (code !== 0) {
							throw new Error(
								`Could not read file from Docker Host. Code: ${code}`,
							);
						}
					})
					.get('data'),
			),
	);
});

const defaultVolumes = {
	'/data': {},
	'/lib/modules': {},
	'/lib/firmware': {},
	'/host/run/dbus': {},
};

const defaultBinds = function (dataPath: any) {
	const data = `/mnt/data/resin-data/${dataPath}:/data`;

	return [
		data,
		'/lib/modules:/lib/modules',
		'/lib/firmware:/lib/firmware',
		'/run/dbus:/host/run/dbus',
	];
};

// 'dockerProgressStream' is a stream of JSON objects emitted during the build
// 'outStream' is the output stream to pretty-print docker progress
//
// This function returns a promise that is rejected on error or resolves with 'true'
//
// Based on https://github.com/docker/docker/blob/master/pkg/jsonmessage/jsonmessage.go
//
const prettyPrintDockerProgress = function (
	dockerProgressStream: NodeJS.ReadableStream,
	outStream: NodeJS.WriteStream = process.stdout,
) {
	const esc = '\u001B';

	const clearCurrentLine = `${esc}[2K\r`;

	const moveCursorUp = function (rows: number = 0) {
		return `${esc}[${rows}A`;
	};

	const moveCursorDown = function (rows: number = 0) {
		return `${esc}[${rows}B`;
	};

	const display = function (
		jsonEvent: { id?: any; progress?: any; stream?: any; status?: any } = {},
	) {
		const { id, progress, stream, status } = jsonEvent;

		outStream.write(clearCurrentLine);

		if (!_.isEmpty(id)) {
			outStream.write(`${id}: `);
		}

		if (!_.isEmpty(progress)) {
			return outStream.write(`${status} ${progress}\r`);
		} else if (!_.isEmpty(stream)) {
			return outStream.write(`${stream}\r`);
		} else {
			return outStream.write(`${status}\r`);
		}
	};

	return new Promise(function (resolve, reject) {
		let ids: { [key: string]: any } = {};

		return (
			dockerProgressStream
				// TODO: fix any typing here
				.pipe((JSONStream as any).parse())
				.on('data', function (jsonEvent: { error?: any; id?: string } = {}) {
					const { error, id } = jsonEvent;

					if (error != null) {
						return reject(new Error(error));
					}

					let diff = 0;
					let line = id ? ids[id] : null;

					if (id != null) {
						if (line == null) {
							line = _.size(ids);
							ids[id] = line;
							outStream.write('\n');
						} else {
							diff = _.size(ids) - line;
						}
						outStream.write(moveCursorUp(diff));
					} else {
						ids = {};
					}

					display(jsonEvent);

					if (id != null) {
						return outStream.write(moveCursorDown(diff));
					}
				})
				.on('end', () => resolve(true))
				.on('error', (error: any) => reject(error))
		);
	});
};

export class DockerUtils {
	docker: Docker;

	constructor(dockerHostIp: string, port: number = dockerPort) {
		this.getAllImages = this.getAllImages.bind(this);
		this.isBalena = this.isBalena.bind(this);
		if (dockerHostIp == null) {
			throw new Error(
				'Device Ip/Host is required to instantiate an DockerUtils client',
			);
		}
		this.docker = new Docker({ host: dockerHostIp, port });
	}

	// Resolve with true if image with 'name' exists. Resolve
	// false otherwise and reject promise on unknown error
	checkForExistingImage(name: string) {
		return Promise.try(() => {
			return this.docker
				.getImage(name)
				.inspect()
				.then((_imageInfo) => true)
				.catch(function (err: { statusCode: string }) {
					const statusCode = '' + err.statusCode;
					if (statusCode === '404') {
						return false;
					}
					throw new Error(`Error while inspecting image ${name}: ${err}`);
				});
		});
	}

	// Resolve with true if container with 'name' exists and is running. Resolve
	// false otherwise and reject promise on unknown error
	checkForRunningContainer(name: string) {
		return Promise.try(() => {
			return this.docker
				.getContainer(name)
				.inspect()
				.then((containerInfo) => containerInfo?.State?.Running ?? false)
				.catch(function (err: { statusCode: string }) {
					const statusCode = '' + err.statusCode;
					if (statusCode === '404') {
						return false;
					}
					throw new Error(`Error while inspecting container ${name}: ${err}`);
				});
		});
	}

	getAllImages() {
		return this.docker.listImages();
	}

	buildImage({
		baseDir,
		name,
		outStream = process.stdout,
		cacheFrom,
	}: {
		baseDir: string;
		name: string;
		cacheFrom: string;
		outStream?: NodeJS.WriteStream;
	}) {
		return Promise.try(() => {
			const tarStream = tar.pack(baseDir);

			return this.docker.buildImage(tarStream, {
				t: `${name}`,
				cachefrom: cacheFrom,
			});
		}).then((dockerProgressOutput) =>
			prettyPrintDockerProgress(dockerProgressOutput, outStream),
		);
	}

	/**
	 * @summary Create a container
	 * @function createContainer
	 *
	 * @param {String} name - Container name - and Image with the same name must already exist
	 * @param {Object} [options] - options
	 * @param {Array} [options.env=[]] - environment variables in the form [ 'ENV=value' ]
	 *
	 * @returns {}
	 * @throws Exception on error
	 */
	createContainer(name: any, { env = [] }: { env?: string[] } = {}) {
		return Promise.try(() => {
			if (!_.isArray(env)) {
				throw new Error(
					'createContainer(): expecting an array of environment variables',
				);
			}

			return this.docker.getImage(name).inspect();
		}).then((imageInfo) => {
			let cmd;
			if (imageInfo?.Config?.Cmd) {
				cmd = imageInfo.Config.Cmd;
			} else {
				cmd = ['/bin/bash', '-c', '/start'];
			}

			return this.docker.createContainer({
				name,
				Image: name,
				Cmd: cmd,
				Env: validateEnvVar(env),
				Tty: true,
				Volumes: defaultVolumes,
				HostConfig: {
					Privileged: true,
					Binds: defaultBinds(name),
					NetworkMode: 'host',
					RestartPolicy: {
						Name: 'always',
						MaximumRetryCount: 0,
					},
				},
			});
		});
	}

	startContainer(name: any) {
		return Promise.try(() => {
			return this.docker.getContainer(name).start();
		}).catch(function (err) {
			// Throw unless the error code is 304 (the container was already started)
			const statusCode = '' + err.statusCode;
			if (statusCode !== '304') {
				throw new Error(`Error while starting container ${name}: ${err}`);
			}
		});
	}

	stopContainer(name: any) {
		return Promise.try(() => {
			return this.docker.getContainer(name).stop({ t: 10 });
		}).catch(function (err) {
			// Container stop should be considered successful if we receive any
			// of these error codes:
			//
			// 404: container not found
			// 304: container already stopped
			const statusCode = '' + err.statusCode;
			if (statusCode !== '404' && statusCode !== '304') {
				throw new Error(`Error while stopping container ${name}: ${err}`);
			}
		});
	}

	removeContainer(name: any) {
		return Promise.try(() => {
			return this.docker.getContainer(name).remove({ v: true });
		}).catch(function (err) {
			// Throw unless the error code is 404 (the container was not found)
			const statusCode = '' + err.statusCode;
			if (statusCode !== '404') {
				throw new Error(`Error while removing container ${name}: ${err}`);
			}
		});
	}

	removeImage(name: any) {
		return Promise.try(() => {
			return this.docker.getImage(name).remove({ force: true });
		}).catch(function (err) {
			// Image removal should be considered successful if we receive any
			// of these error codes:
			//
			// 404: image not found
			const statusCode = '' + err.statusCode;
			if (statusCode !== '404') {
				throw new Error(`Error while removing image ${name}: ${err}`);
			}
		});
	}

	inspectImage(name: any) {
		return Promise.try(() => {
			return this.docker.getImage(name).inspect();
		});
	}

	// Pipe stderr and stdout of container 'name' to stream
	pipeContainerStream(
		name: any,
		outStream: NodeJS.WriteStream = process.stdout,
	) {
		return Promise.try(() => {
			const container = this.docker.getContainer(name);
			return container
				.inspect()
				.then((containerInfo) => containerInfo?.State?.Running)
				.then((isRunning: any) =>
					container.attach({
						logs: !isRunning,
						stream: isRunning,
						stdout: true,
						stderr: true,
					}),
				)
				.then((containerStream: { pipe: (arg0: any) => any }) =>
					containerStream.pipe(outStream),
				);
		});
	}

	followContainerLogs(
		appName: null,
		outStream: NodeJS.WriteStream = process.stdout,
	) {
		return Promise.try(() => {
			if (appName == null) {
				throw new Error('Please give an application name to stream logs from');
			}

			return this.pipeContainerStream(appName, outStream);
		});
	}

	// Gets a string `container` (id or name) as input and returns a promise that
	// resolves to the absolute path of the root directory for that container
	//
	// Setting the 'host' parameter implies that the docker host is located on a network-accessible device,
	// so any file reads will take place on that host (instead of locally) over SSH.
	//
	containerRootDir(container: string, host: string, port: any) {
		return Promise.all([
			this.docker.info(),
			this.docker.version(),
			this.docker.getContainer(container).inspect(),
		]).spread(function (dockerInfo, versionData, containerInfo) {
			const dockerVersion = versionData.Version;
			const dkroot = dockerInfo.DockerRootDir;

			const containerId = containerInfo.Id;

			return Promise.try(function () {
				let readFile;
				if (
					rSemver.valid(dockerVersion) &&
					rSemver.lt(dockerVersion, '1.10.0')
				) {
					return containerId;
				}

				// Else: either it's a release after 1.10.0, or its one of the fun new non-semver versions,
				// which we incidentally know all appeared after 1.10.0

				const destFile = path.join(
					dkroot,
					`image/${dockerInfo.Driver}/layerdb/mounts`,
					containerId,
					'mount-id',
				);

				if (host != null) {
					readFile = _.partial(readFileViaSSH, host, port);
				} else {
					// TODO: fix this any typing
					readFile = (fs as any).readFileAsync;
				}

				// Resolves with 'destId'
				return readFile(destFile);
			}).then(function (destId) {
				switch (dockerInfo.Driver) {
					case 'btrfs':
						return path.join(dkroot, 'btrfs/subvolumes', destId);
					case 'overlay':
						return containerInfo.GraphDriver.Data.RootDir;
					case 'overlay2':
						return containerInfo.GraphDriver.Data.MergedDir;
					case 'vfs':
						return path.join(dkroot, 'vfs/dir', destId);
					case 'aufs':
						return path.join(dkroot, 'aufs/mnt', destId);
					default:
						throw new Error(`Unsupported driver: ${dockerInfo.Driver}/`);
				}
			});
		});
	}

	isBalena() {
		return (
			this.docker
				.version()
				// TODO: fix this any typing
				.then((version: any) => version.Engine === 'balena')
		);
	}
}
