
/**
 * Helper methods for build-trigger `rdt push` feature
 * @module build-trigger
 */
var FileChangedError, Promise, TypedError, _, crypto, fileExists, fs, getFileHash, path,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

fs = require('fs');

path = require('path');

crypto = require('crypto');

Promise = require('bluebird');

_ = require('lodash');

TypedError = require('typed-error');

fileExists = require('./utils').fileExists;

FileChangedError = (function(superClass) {
  extend(FileChangedError, superClass);

  function FileChangedError() {
    return FileChangedError.__super__.constructor.apply(this, arguments);
  }

  return FileChangedError;

})(TypedError);


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
 * getFileHash('package.json').then (hash) ->
 *		console.log('hash')
 */

exports.getFileHash = getFileHash = Promise.method(function(file, algo) {
  if (algo == null) {
    algo = 'sha256';
  }
  return new Promise(function(resolve, reject) {
    var err, hash, input;
    try {
      hash = crypto.createHash(algo);
      input = fs.createReadStream(file);
      return input.on('readable', function() {
        var data;
        data = input.read();
        if (data != null) {
          return hash.update(data);
        }
        return resolve(hash.digest('hex'));
      }).on('error', reject);
    } catch (error) {
      err = error;
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
 * createBuildTriggerHashes({ files: [ 'package.json', 'Dockerfile' ] }).then (hashes) ->
 * // resolves with 'hashes' array:
 * [
 *		{ 'package.json': <sha256> }
 *		{ 'Dockerfile': <sha256> }
 *	]
 *
 */

module.exports.createBuildTriggerHashes = Promise.method(function(arg) {
  var baseDir, buildTriggers, files, ref, ref1, ref2, skipMissing;
  files = (ref = arg.files) != null ? ref : [], baseDir = (ref1 = arg.baseDir) != null ? ref1 : process.cwd(), skipMissing = (ref2 = arg.skipMissing) != null ? ref2 : true;
  buildTriggers = _.union(files, ['Dockerfile', 'package.json']);
  buildTriggers = _.chain(buildTriggers).filter(function(filename) {
    return !_.isEmpty(filename);
  }).map(function(filename) {
    return filename.trim();
  }).map(function(filename) {
    if (!path.isAbsolute(filename)) {
      return path.join(baseDir, filename);
    }
    return filename;
  }).uniq().filter(function(filename) {
    if (!fileExists(filename)) {
      if (!skipMissing) {
        throw new Error("Could not calculate hash - File does not exist: " + filename);
      }
      return false;
    }
    return true;
  }).map(function(filename) {
    return path.relative(baseDir, filename);
  }).value();
  return Promise.map(buildTriggers, function(filename) {
    return getFileHash(path.join(baseDir, filename)).then(function(hash) {
      var result;
      result = {};
      result[filename] = hash;
      return result;
    });
  });
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
 * checkTriggers('package.json': 1234, 'Dockerfile': 5678).then (triggered) ->
 *		console.log(triggered)
 */

module.exports.checkTriggers = Promise.method(function(buildTriggers, baseDir) {
  if (baseDir == null) {
    baseDir = process.cwd();
  }
  if (_.isEmpty(buildTriggers)) {
    return false;
  }
  return Promise.map(buildTriggers, function(trigger) {
    var filename, ref, saved_hash;
    ref = _.toPairs(trigger)[0], filename = ref[0], saved_hash = ref[1];
    filename = path.join(baseDir, filename);
    if (!fileExists(filename)) {
      throw new FileChangedError('File missing:', filename);
    }
    return getFileHash(filename).then(function(hash) {
      if (hash !== saved_hash) {
        throw new FileChangedError('File changed:', filename);
      }
    });
  }).then(function() {
    return false;
  })["catch"](FileChangedError, function(err) {
    return true;
  })["catch"](function(err) {
    var ref;
    console.log('[Warning] Error while checking build trigger hashes', (ref = err != null ? err.message : void 0) != null ? ref : err);
    return true;
  });
});
