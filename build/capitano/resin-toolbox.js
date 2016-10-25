
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
module.exports = {
  signature: 'push [deviceIp]',
  description: 'Push your changes to a container on local resinOS device ',
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
    }, {
      signature: 'env',
      parameter: 'env',
      description: "environment variable (e.g. --env 'ENV=value'). Multiple --env parameters are supported.",
      alias: 'e'
    }
  ],
  action: function(params, options, done) {
    var Promise, RdtDockerUtils, _, build, chalk, checkTriggers, configYml, createBuildTriggerHashes, fileExists, parseOptions, path, ref, ref1, ref2, runtimeOptions, selectAppName, selectLocalResinOsDevice, selectSyncDestination, sync, yamlConfig;
    path = require('path');
    Promise = require('bluebird');
    _ = require('lodash');
    chalk = require('chalk');
    yamlConfig = require('../yaml-config');
    parseOptions = require('./parse-options');
    RdtDockerUtils = require('../docker-utils');
    ref = require('../forms'), selectAppName = ref.selectAppName, selectSyncDestination = ref.selectSyncDestination, selectLocalResinOsDevice = ref.selectLocalResinOsDevice;
    fileExists = require('../utils').fileExists;
    sync = require('../sync')('local-resin-os-device').sync;
    ref1 = require('../build-trigger'), createBuildTriggerHashes = ref1.createBuildTriggerHashes, checkTriggers = ref1.checkTriggers;

    /**
    		 * @summary Start image-building 'rdt push' process
    		 * @function build
    		 *
    		 * @param {Object} options - options
    		 * @param {String} options.appName - Application image (i.e. image & container name)
    		 * @param {String} options.deviceIp - Device ip or host
    		 * @param {String} [options.baseDir=process.cwd()] - Project base directory that also containers Dockerfile
    		 *
    		 * @returns {} - Exits process with 0 on success or 1 otherwise
    		 * @throws Exception on error
    		 *
    		 * @example
    		 * build(appName: 'test', deviceIp: '192.168.1.1')
     */
    build = function(arg) {
      var appName, baseDir, deviceIp, docker, env, ref2, ref3, ref4;
      ref2 = arg != null ? arg : {}, appName = ref2.appName, deviceIp = ref2.deviceIp, env = (ref3 = ref2.env) != null ? ref3 : [], baseDir = (ref4 = ref2.baseDir) != null ? ref4 : process.cwd();
      if (appName == null) {
        throw new Error("Missing application name for 'rtd push'");
      }
      if (deviceIp == null) {
        throw new Error("Missing device ip/host for 'rtd push'");
      }
      docker = new RdtDockerUtils(deviceIp);
      console.log(chalk.yellow.bold('* Building..'));
      console.log("- Stopping and Removing any previous '" + appName + "' container");
      return docker.stopContainer(appName).then(function() {
        return docker.removeContainer(appName);
      }).then(function() {
        return docker.inspectImage(appName)["catch"](function(err) {
          var statusCode;
          statusCode = '' + err.statusCode;
          if (statusCode === '404') {
            return null;
          }
          throw err;
        });
      }).then(function(oldImageInfo) {
        console.log("- Building new '" + appName + "' image");
        return docker.buildImage({
          baseDir: baseDir,
          name: appName,
          outStream: process.stdout
        }).then(function() {
          return docker.inspectImage(appName);
        }).then(function(newImageInfo) {
          if ((oldImageInfo != null) && oldImageInfo.Id !== newImageInfo.Id) {
            console.log("- Cleaning up previous image of '" + appName + "'");
            return docker.removeImage(oldImageInfo.Id);
          }
        });
      }).then(function() {
        console.log("- Creating '" + appName + "' container");
        return docker.createContainer(appName, {
          env: env
        });
      }).then(function() {
        console.log("- Starting '" + appName + "' container");
        return docker.startContainer(appName);
      });
    };
    ref2 = parseOptions(options, params), runtimeOptions = ref2.runtimeOptions, configYml = ref2.configYml;
    if (!fileExists(path.join(runtimeOptions.baseDir, 'Dockerfile'))) {
      throw new Error("No Dockerfile was found in the project directory: " + runtimeOptions.baseDir);
    }
    return Promise["try"](function() {
      var ref3;
      return (ref3 = runtimeOptions.deviceIp) != null ? ref3 : selectLocalResinOsDevice();
    }).then(function(deviceIp) {
      return Promise.props({
        deviceIp: deviceIp,
        appName: selectAppName(runtimeOptions.appName)
      });
    }).then(function(arg) {
      var appName, configYmlBuildTriggers, deviceIp, docker;
      deviceIp = arg.deviceIp, appName = arg.appName;
      runtimeOptions.deviceIp = deviceIp;
      runtimeOptions.appName = appName;
      configYml['local_resinos']['app-name'] = appName;
      docker = new RdtDockerUtils(deviceIp);
      configYmlBuildTriggers = configYml['local_resinos']['build-triggers'];
      return Promise.reduce([
        _.isEmpty(configYmlBuildTriggers) || !_.isEmpty(options['build-triggers']), runtimeOptions.forceBuild, checkTriggers(configYmlBuildTriggers), docker.checkForExistingImage(appName).then(function(exists) {
          return !exists;
        }), docker.checkForRunningContainer(appName).then(function(isRunning) {
          return !isRunning;
        })
      ], function(shouldRebuild, result, index) {
        return shouldRebuild || result;
      }, false).then(function(shouldRebuild) {
        if (shouldRebuild) {
          return createBuildTriggerHashes({
            baseDir: runtimeOptions.baseDir,
            files: runtimeOptions.buildTriggerFiles
          }).then(function(buildTriggerHashes) {
            configYml['local_resinos']['build-triggers'] = buildTriggerHashes;
            configYml['local_resinos']['environment'] = runtimeOptions.env;
            yamlConfig.save(configYml, runtimeOptions.baseDir);
            return build(_.pick(runtimeOptions, ['baseDir', 'deviceIp', 'appName', 'env']));
          });
        } else {
          console.log(chalk.yellow.bold('* Syncing..'));
          return selectSyncDestination(runtimeOptions.destination).then(function(destination) {
            var notNil;
            runtimeOptions.destination = destination;
            notNil = function(val) {
              return !_.isNil(val);
            };
            yamlConfig.save(_.assign({}, configYml, _(runtimeOptions).pick(['destination', 'ignore', 'before', 'after']).pickBy(notNil).value()), runtimeOptions.baseDir);
            return sync(_.pick(runtimeOptions, ['baseDir', 'deviceIp', 'appName', 'destination', 'before', 'after', 'progress', 'verbose', 'skipGitignore', 'ignore']));
          });
        }
      }).then(function() {
        return console.log(chalk.green.bold('\nrdt push completed successfully!'));
      })["catch"](function(err) {
        console.log(chalk.red.bold('rdt push failed.', err, err.stack));
        return process.exit(1);
      }).then(function() {
        if (runtimeOptions.skipLogs === true) {
          return process.exit(0);
        }
        console.log(chalk.yellow.bold('* Streaming application logs..'));
        return docker.followContainerLogs(appName)["catch"](function(err) {
          console.log('[Info] Could not stream logs from container', err);
          return process.exit(0);
        });
      });
    }).nodeify(done);
  }
};
