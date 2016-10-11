
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
var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

module.exports = {
  signature: 'push [deviceIp]',
  description: 'Push your changes to a container on local ResinOS device ',
  help: 'WARNING: If you\'re running Windows, this command only supports `cmd.exe`.\n\nUse this command to push your local changes to a container on a LAN-accessible resinOS device on the fly.\n\nIf `Dockerfile` or any file in the \'build-triggers\' list is changed, a new container will be built and run on your device.\nIf not, changes will simply be synced with `rsync` into the application container.\n\nAfter every \'rdt push\' the updated settings will be saved in\n\'<source>/.resin-sync.yml\' and will be used in later invocations. You can\nalso change any option by editing \'.resin-sync.yml\' directly.\n\nHere is an example \'.resin-sync.yml\' :\n\n	$ cat $PWD/.resin-sync.yml\n	destination: \'/usr/src/app\'\n	before: \'echo Hello\'\n	after: \'echo Done\'\n	ignore:\n		- .git\n		- node_modules/\n\nCommand line options have precedence over the ones saved in \'.resin-sync.yml\'.\n\nIf \'.gitignore\' is found in the source directory then all explicitly listed files will be\nexcluded when using rsync to update the container. You can choose to change this default behavior with the\n\'--skip-gitignore\' option.\n\nExamples:\n\n	$ rdt push\n	$ rdt push --app-name test-server --build-triggers package.json,requirements.txt\n	$ rdt push --force-build\n	$ rdt push --force-build --skip-logs\n	$ rdt push --ignore lib/\n	$ rdt push --verbose false\n	$ rdt push 192.168.2.10 --source . --destination /usr/src/app\n	$ rdt push 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before \'echo Hello\' --after \'echo Done\'',
  primary: true,
  options: [
    {
      signature: 'source',
      parameter: 'path',
      description: 'root of project directory to push',
      alias: 's'
    }, {
      signature: 'destination',
      parameter: 'path',
      description: 'destination path on device container',
      alias: 'd'
    }, {
      signature: 'ignore',
      parameter: 'paths',
      description: "comma delimited paths to ignore when syncing with 'rsync'",
      alias: 'i'
    }, {
      signature: 'skip-gitignore',
      boolean: true,
      description: 'do not parse excluded/included files from .gitignore'
    }, {
      signature: 'before',
      parameter: 'command',
      description: 'execute a command before pushing',
      alias: 'b'
    }, {
      signature: 'after',
      parameter: 'command',
      description: 'execute a command after pushing',
      alias: 'a'
    }, {
      signature: 'progress',
      boolean: true,
      description: 'show progress',
      alias: 'p'
    }, {
      signature: 'skip-logs',
      boolean: true,
      description: 'do not stream logs after push'
    }, {
      signature: 'verbose',
      boolean: true,
      description: 'increase verbosity',
      alias: 'v'
    }, {
      signature: 'app-name',
      parameter: 'name',
      description: 'application name - may contain lowercase characters, digits and one or more dashes. It may not start or end with a dash.',
      alias: 'n'
    }, {
      signature: 'build-triggers',
      parameter: 'files',
      description: 'comma delimited file list that will trigger a container rebuild if changed',
      alias: 'r'
    }, {
      signature: 'force-build',
      boolean: true,
      description: 'force a container build and run',
      alias: 'f'
    }
  ],
  action: function(params, options, done) {
    var Promise, _, buildAction, buildImage, chalk, checkBuildTriggers, checkFileExistsSync, checkForExistingImage, checkForRunningContainer, cliAppName, cliBuildTriggersList, cliForceBuild, cliSkipLogs, createBuildTriggerHashes, createContainer, crypto, dockerInit, ensureDockerfileExists, followContainerLogs, form, fs, getDeviceIp, getFileHash, getSyncOptions, inspectImage, loadResinSyncYml, path, pipeContainerStream, ref, ref1, ref2, ref3, removeContainer, removeImage, save, selectLocalResinOsDeviceForm, setAppName, setBuildTriggerHashes, startContainer, stopContainer, sync, syncAction;
    fs = require('fs');
    path = require('path');
    crypto = require('crypto');
    Promise = require('bluebird');
    _ = require('lodash');
    chalk = require('chalk');
    form = require('resin-cli-form');
    save = require('../config').save;
    ref = require('../utils'), getSyncOptions = ref.getSyncOptions, loadResinSyncYml = ref.loadResinSyncYml;
    selectLocalResinOsDeviceForm = require('../discover').selectLocalResinOsDeviceForm;
    ref1 = require('../docker-utils'), dockerInit = ref1.dockerInit, checkForExistingImage = ref1.checkForExistingImage, checkForRunningContainer = ref1.checkForRunningContainer, buildImage = ref1.buildImage, removeImage = ref1.removeImage, inspectImage = ref1.inspectImage, createContainer = ref1.createContainer, startContainer = ref1.startContainer, stopContainer = ref1.stopContainer, removeContainer = ref1.removeContainer, pipeContainerStream = ref1.pipeContainerStream;
    sync = require('../sync')('local-resin-os-device').sync;
    setAppName = Promise.method(function(resinSyncYml, preferredAppName) {
      var validateAppName;
      validateAppName = Promise.method(function(appName) {
        var hasValidChars, validCharsRegExp;
        validCharsRegExp = new RegExp('^[a-z0-9-]+$');
        if (_.isEmpty(appName)) {
          throw new Error('Application name should not be empty.');
        }
        hasValidChars = validCharsRegExp.test(appName);
        if (!hasValidChars || _.startsWith(appName, '-') || _.endsWith(appName, '-')) {
          throw new Error('Application name may only contain lowercase characters, digits and one or more dashes. It may not start or end with a dash.');
        }
        return appName;
      });
      return form.run([
        {
          message: 'Select a name for the application',
          name: 'appname',
          type: 'input'
        }
      ], {
        override: {
          appname: preferredAppName
        }
      }).get('appname').call('trim').then(validateAppName).tap(function(appName) {
        resinSyncYml['local_resinos']['app-name'] = appName;
        return save(_.omit(resinSyncYml, ['source']), resinSyncYml.source);
      });
    });
    checkFileExistsSync = function(filename) {
      var err;
      try {
        fs.accessSync(filename);
        return true;
      } catch (error) {
        err = error;
        if (err.code === 'ENOENT') {
          return false;
        }
        throw new Error("Could not access " + filename + ": " + err);
      }
    };
    ensureDockerfileExists = Promise.method(function(baseDir) {
      var dockerfileExists;
      if (baseDir == null) {
        baseDir = process.cwd();
      }
      dockerfileExists = checkFileExistsSync(path.join(baseDir, 'Dockerfile'));
      if (!dockerfileExists) {
        throw new Error("No Dockerfile was found in the project directory: " + baseDir);
      }
    });
    getDeviceIp = Promise.method(function(deviceIp) {
      if (deviceIp != null) {
        return deviceIp;
      }
      return selectLocalResinOsDeviceForm();
    });
    getFileHash = Promise.method(function(file, algo) {
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
    createBuildTriggerHashes = Promise.method(function(baseDir, buildTriggersList) {
      if (buildTriggersList == null) {
        buildTriggersList = [];
      }
      if (baseDir == null) {
        throw new Error('baseDir is required to create build trigger hashes');
      }
      buildTriggersList = _.union(buildTriggersList, ['Dockerfile', 'package.json']);
      buildTriggersList = _.chain(buildTriggersList).filter(function(filename) {
        return !_.isEmpty(filename);
      }).map(function(filename) {
        return filename.trim();
      }).filter(function(filename) {
        return checkFileExistsSync(path.join(baseDir, filename));
      }).value();
      return Promise.map(buildTriggersList, function(filename) {
        return getFileHash(filename).then(function(hash) {
          var result;
          result = {};
          result[filename] = hash;
          return result;
        });
      });
    });
    setBuildTriggerHashes = Promise.method(function(resinSyncYml, buildTriggersList) {
      if (buildTriggersList == null) {
        buildTriggersList = [];
      }
      return createBuildTriggerHashes(resinSyncYml['source'], buildTriggersList).then(function(buildTriggerHashes) {
        resinSyncYml['local_resinos']['build-triggers'] = buildTriggerHashes;
        return save(_.omit(resinSyncYml, ['source']), resinSyncYml.source);
      });
    });
    checkBuildTriggers = Promise.method(function(resinSyncYml) {
      var baseDir, ref2, savedBuildTriggers;
      savedBuildTriggers = resinSyncYml != null ? (ref2 = resinSyncYml['local_resinos']) != null ? ref2['build-triggers'] : void 0 : void 0;
      if (!savedBuildTriggers) {
        return true;
      }
      baseDir = resinSyncYml['source'];
      return Promise.map(savedBuildTriggers, function(trigger) {
        var fileExists, filename, ref3, saved_hash;
        ref3 = _.toPairs(trigger)[0], filename = ref3[0], saved_hash = ref3[1];
        filename = path.join(baseDir, filename);
        fileExists = checkFileExistsSync(filename);
        if (!fileExists) {
          return true;
        }
        return getFileHash(filename).then(function(hash) {
          if (hash !== saved_hash) {
            return true;
          }
          return false;
        });
      }).then(function(results) {
        return indexOf.call(results, true) >= 0;
      })["catch"](function(err) {
        console.log('Error while checking build trigger hashes', err);
        return true;
      });
    });
    followContainerLogs = Promise.method(function(appName, outStream) {
      if (outStream == null) {
        outStream = process.stdout;
      }
      if (appName == null) {
        throw new Error('Please give an application name to stream logs from');
      }
      console.log(chalk.yellow.bold('* Streaming application logs..'));
      return pipeContainerStream(appName, outStream)["catch"](function(err) {
        return console.log('Could not stream application logs.', err);
      });
    });
    buildAction = function(arg) {
      var appName, buildDir, outStream, ref2, ref3, ref4, ref5, skipLogs;
      ref2 = arg != null ? arg : {}, appName = ref2.appName, buildDir = (ref3 = ref2.buildDir) != null ? ref3 : process.cwd(), outStream = (ref4 = ref2.outStream) != null ? ref4 : process.stdout, skipLogs = (ref5 = ref2.skipLogs) != null ? ref5 : false;
      if (appName == null) {
        throw new Error('Please give an application name to build');
      }
      console.log(chalk.yellow.bold('* Building..'));
      console.log("- Stopping and Removing any previous '" + appName + "' container");
      return stopContainer(appName).then(function() {
        return removeContainer(appName);
      }).then(function() {
        return inspectImage(appName)["catch"](function(err) {
          var statusCode;
          statusCode = '' + err.statusCode;
          if (statusCode === '404') {
            return null;
          }
          throw err;
        });
      }).then(function(oldImageInfo) {
        console.log("- Building new '" + appName + "' image");
        return buildImage({
          baseDir: buildDir != null ? buildDir : process.cwd(),
          name: appName,
          outStream: outStream != null ? outStream : process.stdout
        }).then(function() {
          return inspectImage(appName);
        }).then(function(newImageInfo) {
          if ((oldImageInfo != null) && oldImageInfo.Id !== newImageInfo.Id) {
            console.log("- Cleaning up previous image of '" + appName + "'");
            return removeImage(oldImageInfo.Id);
          }
        });
      }).then(function() {
        console.log("- Creating '" + appName + "' container");
        return createContainer(appName);
      }).then(function() {
        console.log("- Starting '" + appName + "' container");
        return startContainer(appName);
      }).then(function() {
        return console.log(chalk.green.bold('\nrdt push completed successfully!'));
      })["catch"](function(err) {
        console.log(chalk.red.bold('rdt push failed.', err));
        return process.exit(1);
      }).then(function() {
        if (!skipLogs) {
          return followContainerLogs(appName, process.stdout);
        }
      });
    };
    syncAction = function(arg) {
      var appName, cliOptions, deviceIp, ref2, ref3, skipLogs;
      ref2 = arg != null ? arg : {}, cliOptions = ref2.cliOptions, deviceIp = ref2.deviceIp, appName = ref2.appName, skipLogs = (ref3 = ref2.skipLogs) != null ? ref3 : false;
      if (deviceIp == null) {
        throw new Error('Device IP is required for sync action');
      }
      if (appName == null) {
        throw new Error('Application name is required for sync action');
      }
      console.log(chalk.yellow.bold('* Syncing..'));
      return getSyncOptions(cliOptions).then(function(syncOptions) {
        return sync(syncOptions, deviceIp);
      }).then(function() {
        return console.log(chalk.green.bold('\nrdt push completed successfully!'));
      })["catch"](function(err) {
        console.log(chalk.red.bold('rdt push failed.', err));
        return process.exit(1);
      }).then(function() {
        if (!skipLogs) {
          return followContainerLogs(appName, process.stdout);
        }
      });
    };
    if (options['build-triggers'] != null) {
      options['build-triggers'] = options['build-triggers'].split(',');
    }
    cliBuildTriggersList = options['build-triggers'];
    cliAppName = options['app-name'];
    cliForceBuild = (ref2 = options['force-build']) != null ? ref2 : false;
    cliSkipLogs = (ref3 = options['skip-logs']) != null ? ref3 : false;
    return loadResinSyncYml(options.source).then((function(_this) {
      return function(resinSyncYml1) {
        _this.resinSyncYml = resinSyncYml1;
        return ensureDockerfileExists();
      };
    })(this)).then(function() {
      return getDeviceIp(params.deviceIp);
    }).then((function(_this) {
      return function(deviceIp1) {
        _this.deviceIp = deviceIp1;
        return dockerInit(_this.deviceIp);
      };
    })(this)).then((function(_this) {
      return function() {
        var appName;
        if (_this.resinSyncYml['local_resinos'] == null) {
          _this.resinSyncYml['local_resinos'] = {};
        }
        appName = cliAppName != null ? cliAppName : _this.resinSyncYml['local_resinos']['app-name'];
        return setAppName(_this.resinSyncYml, appName);
      };
    })(this)).then((function(_this) {
      return function(appName) {
        var buildDir, savedBuildTriggers, savedBuildTriggersList;
        savedBuildTriggers = _this.resinSyncYml['local_resinos']['build-triggers'];
        savedBuildTriggersList = _.map(savedBuildTriggers, function(trigger) {
          return _.toPairs(trigger)[0][0];
        });
        buildDir = _this.resinSyncYml['source'];
        if (_.isEmpty(savedBuildTriggers) || (cliBuildTriggersList != null)) {
          return setBuildTriggerHashes(_this.resinSyncYml, cliBuildTriggersList).then(function() {
            return buildAction({
              appName: appName,
              buildDir: buildDir,
              skipLogs: cliSkipLogs
            });
          });
        }
        if (cliForceBuild) {
          return buildAction({
            appName: appName,
            buildDir: buildDir,
            skipLogs: cliSkipLogs
          });
        }
        return checkBuildTriggers(_this.resinSyncYml).then(function(shouldRebuild) {
          if (shouldRebuild) {
            return setBuildTriggerHashes(_this.resinSyncYml, savedBuildTriggersList).then(function() {
              return buildAction({
                appName: appName,
                buildDir: buildDir,
                skipLogs: cliSkipLogs
              });
            });
          }
          return Promise.props({
            containerIsRunning: checkForRunningContainer(appName),
            imageExists: checkForExistingImage(appName)
          }).then(function(arg) {
            var containerIsRunning, imageExists;
            containerIsRunning = arg.containerIsRunning, imageExists = arg.imageExists;
            if (imageExists && containerIsRunning) {
              return syncAction({
                appName: appName,
                cliOptions: options,
                deviceIp: _this.deviceIp,
                skipLogs: cliSkipLogs
              });
            }
            return buildAction({
              appName: appName,
              buildDir: buildDir,
              skipLogs: cliSkipLogs
            });
          });
        });
      };
    })(this)).nodeify(done);
  }
};
