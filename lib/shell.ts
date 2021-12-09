import * as child_process from 'child_process';
import * as os from 'os';
import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as rindle from 'rindle';

interface SubShellCommand {
	program: string;
	args: string[];
}

/**
 * @summary Get sub shell command
 * @function
 * @protected
 *
 * @param {String} command - command
 * @returns {SubShellCommand} sub shell command
 *
 * @example
 * subShellCommand = shell.getSubShellCommand('foo')
 */
export const getSubShellCommand = function (command: string): SubShellCommand {
	if (os.platform() === 'win32') {
		return {
			program: 'cmd.exe',
			args: ['/s', '/c', command],
		};
	} else {
		return {
			program: '/bin/sh',
			args: ['-c', command],
		};
	}
};

/**
 * @summary Run a command in a subshell
 * @function
 * @protected
 *
 * @description
 * stdin is inherited from the parent process.
 *
 * @param {String} command - command
 * @param {String} cwd - current working directory
 * @returns {Promise}
 *
 * @example
 * shell.runCommand('echo hello').then ->
 * 	console.log('Done!')
 */
export const runCommand = function (command: string, cwd?: string) {
	return Promise.try(function () {
		const env: any = {};

		if (os.platform() === 'win32') {
			// Under Windows, openssh attempts to read SSH keys from
			// `/home/<username>`, however this makes no sense in Windows.
			// As a workaround, we can set the %HOME% environment variable
			// to `/<home drive letter>/Users/<user>` to trick openssh
			// to read ssh keys from `<home drive letter>:\Users\<user>\.ssh`
			const homedrive = _.get(process, 'env.homedrive', 'C:')
				.slice(0, 1)
				.toLowerCase();
			const homepath = _.get(process, 'env.homepath', '').replace(/\\/g, '/');
			env.HOME = `/${homedrive}${homepath}`;
		}

		const subShellCommand = getSubShellCommand(command);
		const spawn = child_process.spawn(
			subShellCommand.program,
			subShellCommand.args,
			{
				stdio: 'inherit',
				env: _.merge(env, process.env),
				cwd,

				// This is an internal undocumented option that causes
				// spawn to execute multiple word commands correctly
				// on Windows when passing them to `cmd.exe`
				// See https://github.com/nodejs/node-v0.x-archive/issues/2318#issuecomment-3220048
				windowsVerbatimArguments: true,
			},
		);

		return rindle.wait(spawn).spread(function (code) {
			if (code === 0) {
				return;
			}
			throw new Error(`Child process exited with code ${code}`);
		});
	});
};
