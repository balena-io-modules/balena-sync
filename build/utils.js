
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
var revalidator, unescapeSpaces, _;

_ = require('lodash');

revalidator = require('revalidator');


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
  var exclude, fs, include, patterns;
  fs = require('fs');
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
