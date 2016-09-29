
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
var Promise, Spinner, form, fs, load, path, revalidator, unescapeSpaces, _;

fs = require('fs');

path = require('path');

Promise = require('bluebird');

_ = require('lodash');

revalidator = require('revalidator');

Spinner = require('resin-cli-visuals').Spinner;

form = require('resin-cli-form');

load = require('./config').load;


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

exports.spinnerPromise = Promise.method(function(promise, startMsg, stopMsg) {
  var clearSpinner, spinner;
  clearSpinner = function(spinner, msg) {
    if (spinner != null) {
      spinner.stop();
    }
    if (msg != null) {
      return console.log(msg);
    }
  };
  spinner = new Spinner(startMsg);
  spinner.start();
  return promise.tap(function(value) {
    return clearSpinner(spinner, stopMsg);
  })["catch"](function(err) {
    clearSpinner(spinner);
    throw err;
  });
});

exports.startContainer = function(promise) {
  return exports.spinnerPromise(promise, 'Starting application container...', 'Application container started.');
};

exports.stopContainer = function(promise) {
  return exports.spinnerPromise(promise, 'Stopping application container...', 'Application container stopped.');
};

exports.startContainerAfterError = function(promise) {
  return exports.spinnerPromise(promise, 'Attempting to start application container after failed \'sync\'...', 'Application container started after failed \'sync\'.');
};

exports.getSyncOptions = function(options) {
  if (options == null) {
    options = {};
  }
  return Promise["try"](function() {
    try {
      if (options.source == null) {
        fs.accessSync(path.join(process.cwd(), '.resin-sync.yml'));
        options.source = process.cwd();
      }
    } catch (_error) {
      throw new Error('No --source option passed and no \'.resin-sync.yml\' file found in current directory.');
    }
    return load(options.source);
  }).then(function(resinSyncYml) {
    var syncOptions;
    syncOptions = {};
    if (options.ignore != null) {
      options.ignore = options.ignore.split(',');
    }
    _.mergeWith(syncOptions, resinSyncYml, options, function(objVal, srcVal, key) {
      if (key === 'ignore') {
        return srcVal;
      }
    });
    syncOptions.ignore = _.filter(syncOptions.ignore, function(item) {
      return !_.isEmpty(item);
    });
    if (syncOptions.ignore.length === 0 && (resinSyncYml.ignore == null)) {
      syncOptions.ignore = ['.git', 'node_modules/'];
    }
    return form.run([
      {
        message: 'Destination directory on device container [/usr/src/app]',
        name: 'destination',
        type: 'input'
      }
    ], {
      override: {
        destination: syncOptions.destination
      }
    }).get('destination').then(function(destination) {
      return _.assign(syncOptions, {
        destination: destination != null ? destination : '/usr/src/app'
      });
    });
  });
};
