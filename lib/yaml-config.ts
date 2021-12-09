/**
 * Helper methods to manipulate the balena push/sync configuration file (currently .balena-sync.yml)
 * @module build-trigger
 */
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as jsYaml from 'js-yaml';
import { fileExists } from './utils';

export const CONFIG_FILE = '.balena-sync.yml';
export const LEGACY_CONFIG_FILE = '.resin-sync.yml';

/**
 * @summary Get config path
 * @function
 * @private
 *
 * @param {String} [baseDir=process.cwd()]
 * @param {String} [configFile=CONFIG_FILE]
 *
 * @returns {String} config path
 *
 * @example
 * configPath = config.getPath('.')
 */
export const getPath = function (
	baseDir: string = process.cwd(),
	configFile: string = CONFIG_FILE,
) {
	return path.join(baseDir, configFile);
};

/**
 * @summary Load configuration file
 * @function
 * @protected
 *
 * @description
 * If no configuration file is found, return an empty object.
 *
 * @param {String} [baseDir=process.cwd()]
 * @param {String} [configFile=CONFIG_FILE]
 *
 * @returns {Object} YAML configuration as object
 * @throws Exception on error
 *
 * @example
 * options = config.load('.')
 */
export const load = function (
	baseDir: string = process.cwd(),
	configFile: string = CONFIG_FILE,
): any {
	const configPath = getPath(baseDir, configFile);

	// fileExists() will throw on any error other than 'ENOENT' (file not found)
	if (!fileExists(configPath)) {
		if (configFile === CONFIG_FILE) {
			// Ensure config loading falls back to the legacy config file
			return load(baseDir, LEGACY_CONFIG_FILE);
		}
		return {};
	}

	const config = fs.readFileSync(configPath, { encoding: 'utf8' });
	const result: any = jsYaml.safeLoad(config);

	if (!_.isPlainObject(result)) {
		throw new Error(`Invalid configuration file: ${configPath}`);
	}

	if (result['local_resinos']) {
		result['local_balenaos'] = result['local_resinos'];
		delete result['local_resinos'];
	}

	return result;
};

/**
 * @summary Serializes object as yaml object and saves it to file
 * @function
 * @protected
 *
 * @param {String} yamlObj - YAML object to save
 * @param {String} [baseDir=process.cwd()]
 * @param {String} [configFile=CONFIG_FILE]
 *
 * @throws Exception on error
 * @example
 * config.save(yamlObj)
 */
export const save = function (
	yamlObj: any,
	baseDir: string = process.cwd(),
	configFile: string = CONFIG_FILE,
) {
	const configSavePath = getPath(baseDir, configFile);

	const yamlDump = jsYaml.safeDump(yamlObj);
	return fs.writeFileSync(configSavePath, yamlDump, { encoding: 'utf8' });
};
