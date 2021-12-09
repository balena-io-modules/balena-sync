/**
 * Helper methods for build-trigger `balena local push` feature
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as Promise from 'bluebird';
import * as _ from 'lodash';
import { TypedError } from 'typed-error';
import { fileExists } from './utils';

class FileChangedError extends TypedError {}

/**
 * @summary Return file hash - based on https://nodejs.org/api/crypto.html
 * @function getFileHash
 *
 * @param {String} file - file path
 * @param {String} [algo='sha256'] - Hash algorithm
 *
 * @returns {Promise}
 * @throws Exception on error
 *
 * @example
 * getFileHash('package.json').then((hash) =>
 *   console.log('hash')
 * )
 */
export const getFileHash = Promise.method<string>(function (
	file: string,
	algo = 'sha256',
) {
	return new Promise(function (resolve, reject) {
		try {
			const hash = crypto.createHash(algo);
			const input = fs.createReadStream(file);
			return input
				.on('readable', function () {
					const data = input.read();
					if (data != null) {
						return hash.update(data);
					}
					return resolve(hash.digest('hex'));
				})
				.on('error', reject);
		} catch (err) {
			return reject(err);
		}
	});
});

/**
 * @summary Creates an array of objects with the hashes of the passed files
 * @function
 *
 * @param {Object} options - options
 * @param {String[]} [options.files=[]] - array of file paths to calculate hashes
 * @param {String} [options.baseDir=process.cwd()] - Base directory for relative file paths
 * @param {Boolean} [options.skipMissing=true] - Skip non-existent files from the 'files' array
 *
 * @returns {Promise}
 * @throws Exception on error or if 'skipMissing' is false and a file in the 'files' array does not exis
 *
 * @example
 * createBuildTriggerHashes({ files: [ 'package.json', 'Dockerfile' ] }).then((hashes) =>
 * // resolves with 'hashes' array:
 * [
 *   { 'package.json': <sha256> }
 *   { 'Dockerfile': <sha256> }
 * ]
 */
export const createBuildTriggerHashes = Promise.method(function ({
	files = [],
	baseDir = process.cwd(),
	skipMissing = true,
}: {
	files: string[];
	baseDir?: string;
	skipMissing?: boolean;
}) {
	// Dockerfile and package.json are always included as build triggers
	let buildTriggers = _.union(files, ['Dockerfile', 'package.json']);

	buildTriggers = _.chain(buildTriggers)
		// Filter out empty 'build-triggers' file names (e.g. when passing 'package.json,,,trigger.txt')
		.filter((filename) => !_.isEmpty(filename))
		.map((filename) => filename.trim())
		.map(function (filename) {
			// return full path to easily remove duplicates
			if (!path.isAbsolute(filename)) {
				return path.join(baseDir, filename);
			}
			return filename;
		})
		.uniq()
		.filter(function (filename) {
			if (!fileExists(filename)) {
				if (!skipMissing) {
					throw new Error(
						`Could not calculate hash - File does not exist: ${filename}`,
					);
				}
				return false;
			}
			return true;
		})
		.map(
			(
				filename, // We prefer to save relative file paths in the yaml config so that the paths will still be valid
			) =>
				// if the yaml config (i.e. `balena-sync.yml`) is checked into a git repo and then cloned to another
				// workstation
				path.relative(baseDir, filename),
		)
		.value();

	return Promise.map(buildTriggers, (filename) =>
		getFileHash(path.join(baseDir, filename)).then(function (hash) {
			return {
				[filename]: hash,
			};
		}),
	);
});

/**
 * @summary Checks if any of the files in the build trigger list has changed or is missing
 * @function checkTriggers
 *
 * @param {Object} buildTriggers - Array of { filePath: hash } objects
 * @param {String} [baseDir=process.cwd()] - Base directory for relative file paths in 'buildTriggers'
 *
 * @returns {Promise} - Resolves with true if any file hash has changed or any of the files was missing,
 * false otherwise
 * @throws Exception on error
 *
 * @example
 * checkTriggers('package.json': 1234, 'Dockerfile': 5678).then((triggered) =>
 *   console.log(triggered)
 * )
 */
export const checkTriggers = Promise.method(function (
	buildTriggers: Array<{ [filePath: string]: string }>,
	baseDir: string = process.cwd(),
) {
	if (_.isEmpty(buildTriggers)) {
		return false;
	}

	return Promise.map(buildTriggers, function (trigger) {
		const [name, savedHash] = Array.from(_.toPairs(trigger)[0]);

		const filename = path.join(baseDir, name);

		if (!fileExists(filename)) {
			throw new FileChangedError(`File missing: ${filename}`);
		}

		return getFileHash(filename).then(function (hash) {
			if (hash !== savedHash) {
				throw new FileChangedError(`File changed: ${filename}`);
			}
		});
	})
		.then(() => false)
		.catch(FileChangedError, (_err) => true)
		.catch(function (err) {
			console.log(
				'[Warning] Error while checking build trigger hashes',
				(err != null ? err.message : undefined) != null
					? err != null
						? err.message
						: undefined
					: err,
			);
			return true;
		});
});
