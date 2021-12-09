import * as fs from 'fs';
import * as _ from 'lodash';
import * as revalidator from 'revalidator';
import { SpinnerPromise } from 'resin-cli-visuals';

/**
 * @summary Validate object
 * @function
 * @protected
 *
 * @param {Object} object - input object
 * @param {Object} rules - validation rules
 *
 * @throws Will throw if object is invalid
 *
 * @example
 * utils.validateObject
 * 	foo: 'bar'
 * ,
 * 	properties:
 * 		foo:
 * 			description: 'foo'
 * 			type: 'string'
 * 			required: true
 */
export const validateObject = function (object: any, rules: any) {
	const validation = revalidator.validate(object, rules);

	if (!validation.valid) {
		const error = _.first(validation.errors);
		throw new Error(error!.message);
	}
};

const unescapeSpaces = function (pattern: string) {
	pattern = _.trimStart(pattern);

	// Trailing spaces not quoted with backslash are trimmed
	const quotedTrailSpacesReg = /(.*\\\s)\s*$/;
	if (quotedTrailSpacesReg.test(pattern)) {
		pattern = pattern.match(quotedTrailSpacesReg)![1];
	} else {
		pattern = _.trimEnd(pattern);
	}

	// Unescape spaces - 'file\ name' and 'file name' are equivalent in .gitignore
	return pattern.replace(/\\\s/g, ' ');
};

/**
 * @summary Transform .gitignore patterns to rsync compatible exclude/include patterns
 * @function
 * @protected
 *
 * @description Note that in rsync 'include''s must be set before 'exclude''s
 *
 * @param {String} gitignoreFile - .gitignore file location
 *
 * @returns object with include/exclude options
 * @throws an exception if there was an error accessing the file
 *
 * @example
 * For .gitignore:
 * ```
 * node_modules/
 * lib/*
 * !lib/includeme.coffee
 * ```
 *
 * utils.gitignoreToRsync('.gitignore') returns
 *
 * {
 *   include: [ 'lib/includeme.coffee' ]
 *   exclude: [ 'node_modules/', 'lib/*' ]
 * }
 */
export const gitignoreToRsyncPatterns = function (
	gitignoreFile: number | fs.PathLike,
) {
	let patterns = fs
		.readFileSync(gitignoreFile, { encoding: 'utf8' })
		.split('\n');

	patterns = _.map(patterns, unescapeSpaces);

	// Ignore empty lines and comments
	patterns = _.filter(patterns, function (pattern) {
		if (pattern.length === 0 || _.startsWith(pattern, '#')) {
			return false;
		}
		return true;
	});

	// search for '!'-prefixed patterns to explicitly include
	const include = _.chain(patterns)
		.filter((pattern) => _.startsWith(pattern, '!'))
		.map((pattern) => pattern.replace(/^!/, ''))
		.value();

	// all non '!'-prefixed patterns should be excluded
	const exclude = _.chain(patterns)
		.filter((pattern) => !_.startsWith(pattern, '!'))
		.map(
			(pattern) =>
				(pattern = pattern.replace(/^\\#/, '#').replace(/^\\!/, '!')),
		)
		.value();

	return {
		include: _.uniq(include),
		exclude: _.uniq(exclude),
	};
};

// Resolves with the resolved 'promise' value
export const startContainerSpinner = (startContainerPromise: any) =>
	new SpinnerPromise({
		promise: startContainerPromise,
		startMessage: 'Starting application container...',
		stopMessage: 'Application container started.',
	});

// Resolves with the resolved 'promise' value
export const stopContainerSpinner = (stopContainerPromise: any) =>
	new SpinnerPromise({
		promise: stopContainerPromise,
		startMessage: 'Stopping application container...',
		stopMessage: 'Application container stopped.',
	});

// Resolves with the resolved 'promise' value
export const infoContainerSpinner = (infoContainerPromise: any) =>
	new SpinnerPromise({
		promise: infoContainerPromise,
		startMessage: 'Getting application container info...',
		stopMessage: 'Got application container info.',
	});

// Resolves with the resolved 'promise' value
export const startContainerAfterErrorSpinner = (startContainerPromise: any) =>
	new SpinnerPromise({
		promise: startContainerPromise,
		startMessage:
			"Attempting to start application container after failed 'sync'...",
		stopMessage: "Application container started after failed 'sync'.",
	});

/**
 * @summary Check if file exists
 * @function fileExists
 *
 * @param {Object} filename - file path
 *
 * @returns {Boolean}
 * @throws Exception on error
 *
 * @example
 * dockerfileExists = fileExists('Dockerfile')
 */
export const fileExists = function (filename: fs.PathLike) {
	try {
		fs.accessSync(filename);
		return true;
	} catch (err: any) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw new Error(`Could not access ${filename}: ${err}`);
	}
};

/**
 * @summary Validate 'ENV=value' environment variable(s)
 * @function validateEnvVar
 *
 * @param {String|Array} [env=[]] - 'ENV_NAME=value' string
 *
 * @returns {Array} - returns array of passed env var(s) if valid
 * @throws Exception if a variable name is not valid in accordance with
 * IEEE Std 1003.1-2008, 2016 Edition, Ch. 8, p. 1
 *
 */
export const validateEnvVar = function (env: string | string[] = []): string[] {
	const envVarRegExp = new RegExp('^[a-zA-Z_][a-zA-Z0-9_]*=.*$');

	if (!_.isString(env) && !_.isArray(env)) {
		throw new Error(
			'validateEnvVar(): expecting either Array or String parameter',
		);
	}

	if (_.isString(env)) {
		env = [env];
	}

	for (const e of Array.from(env)) {
		if (!envVarRegExp.test(e)) {
			throw new Error(`Invalid environment variable: ${e}`);
		}
	}

	return env;
};
