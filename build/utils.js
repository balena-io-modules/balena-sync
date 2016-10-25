
/*
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
var SpinnerPromise, _, fs, revalidator, unescapeSpaces;

fs = require('fs');

_ = require('lodash');

revalidator = require('revalidator');

SpinnerPromise = require('resin-cli-visuals').SpinnerPromise;


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

exports.validateObject = function(object, rules) {
  var error, validation;
  validation = revalidator.validate(object, rules);
  if (!validation.valid) {
    error = _.first(validation.errors);
    throw new Error(error.message);
  }
};

unescapeSpaces = function(pattern) {
  var quotedTrailSpacesReg;
  pattern = _.trimStart(pattern);
  quotedTrailSpacesReg = /(.*\\\s)\s*$/;
  if (quotedTrailSpacesReg.test(pattern)) {
    pattern = pattern.match(quotedTrailSpacesReg)[1];
  } else {
    pattern = _.trimEnd(pattern);
  }
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
 *		node_modules/
 *		lib/*
 *		!lib/includeme.coffee
 * ```
 *
 * utils.gitignoreToRsync('.gitignore') returns
 *
 * {
 *		include: [ 'lib/includeme.coffee' ]
 *		exclude: [ 'node_modules/', 'lib/*' ]
 *	}
 */

exports.gitignoreToRsyncPatterns = function(gitignoreFile) {
  var exclude, include, patterns;
  patterns = fs.readFileSync(gitignoreFile, {
    encoding: 'utf8'
  }).split('\n');
  patterns = _.map(patterns, unescapeSpaces);
  patterns = _.filter(patterns, function(pattern) {
    if (pattern.length === 0 || _.startsWith(pattern, '#')) {
      return false;
    }
    return true;
  });
  include = _.chain(patterns).filter(function(pattern) {
    return _.startsWith(pattern, '!');
  }).map(function(pattern) {
    return pattern.replace(/^!/, '');
  }).value();
  exclude = _.chain(patterns).filter(function(pattern) {
    return !_.startsWith(pattern, '!');
  }).map(function(pattern) {
    return pattern = pattern.replace(/^\\#/, '#').replace(/^\\!/, '!');
  }).value();
  return {
    include: _.uniq(include),
    exclude: _.uniq(exclude)
  };
};

exports.startContainerSpinner = function(startContainerPromise) {
  return new SpinnerPromise({
    promise: startContainerPromise,
    startMessage: 'Starting application container...',
    stopMessage: 'Application container started.'
  });
};

exports.stopContainerSpinner = function(stopContainerPromise) {
  return new SpinnerPromise({
    promise: stopContainerPromise,
    startMessage: 'Stopping application container...',
    stopMessage: 'Application container stopped.'
  });
};

exports.startContainerAfterErrorSpinner = function(startContainerPromise) {
  return new SpinnerPromise({
    promise: startContainerPromise,
    startMessage: 'Attempting to start application container after failed \'sync\'...',
    stopMessage: 'Application container started after failed \'sync\'.'
  });
};


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

exports.fileExists = function(filename) {
  var err;
  try {
    fs.accessSync(filename);
    return true;
  } catch (error1) {
    err = error1;
    if (err.code === 'ENOENT') {
      return false;
    }
    throw new Error("Could not access " + filename + ": " + err);
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

exports.validateEnvVar = function(env) {
  var e, envVarRegExp, i, len;
  if (env == null) {
    env = [];
  }
  envVarRegExp = new RegExp('^[a-zA-Z_][a-zA-Z0-9_]*=.*$');
  if (!_.isString(env) && !_.isArray(env)) {
    throw new Error('validateEnvVar(): expecting either Array or String parameter');
  }
  if (_.isString(env)) {
    env = [env];
  }
  for (i = 0, len = env.length; i < len; i++) {
    e = env[i];
    if (!envVarRegExp.test(e)) {
      throw new Error("Invalid environment variable: " + e);
    }
  }
  return env;
};
