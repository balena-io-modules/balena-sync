
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
var DEVICE_SSH_PORT, Promise, SpinnerPromise, _, buildRsyncCommand, checkForRunningContainer, dockerInit, path, ref, ref1, shell, shellwords, startContainer, startContainerAfterErrorSpinner, startContainerSpinner, stopContainer, stopContainerSpinner;

path = require('path');

Promise = require('bluebird');

_ = require('lodash');

shellwords = require('shellwords');

shell = require('../shell');

SpinnerPromise = require('resin-cli-visuals').SpinnerPromise;

buildRsyncCommand = require('../rsync').buildRsyncCommand;

ref = require('../utils'), startContainerSpinner = ref.startContainerSpinner, stopContainerSpinner = ref.stopContainerSpinner, startContainerAfterErrorSpinner = ref.startContainerAfterErrorSpinner;

ref1 = require('../docker-utils'), dockerInit = ref1.dockerInit, startContainer = ref1.startContainer, stopContainer = ref1.stopContainer, checkForRunningContainer = ref1.checkForRunningContainer;

DEVICE_SSH_PORT = 22222;

exports.sync = function(syncOptions, deviceIp) {
  var after, appName, before, destination, ref2, source, syncContainer;
  source = syncOptions.source, destination = syncOptions.destination, before = syncOptions.before, after = syncOptions.after, (ref2 = syncOptions.local_resinos, appName = ref2['app-name']);
  if (destination == null) {
    throw new Error("'destination' is a required sync option");
  }
  if (deviceIp == null) {
    throw new Error("'deviceIp' is a required sync option");
  }
  if (appName == null) {
    throw new Error("'app-name' is a required sync option");
  }
  syncContainer = function(appName, destination, host, port) {
    var docker;
    if (port == null) {
      port = DEVICE_SSH_PORT;
    }
    docker = dockerInit(deviceIp);
    return docker.containerRootDir(appName, host, port).then(function(containerRootDirLocation) {
      var command, rsyncDestination;
      rsyncDestination = path.join(containerRootDirLocation, destination);
      _.assign(syncOptions, {
        username: 'root',
        host: host,
        port: port,
        destination: shellwords.escape(rsyncDestination),
        'rsync-path': "mkdir -p \"" + rsyncDestination + "\" && nsenter --target $(pidof docker) --mount rsync"
      });
      command = buildRsyncCommand(syncOptions);
      return checkForRunningContainer(appName).then(function(isContainerRunning) {
        if (!isContainerRunning) {
          throw new Error("Container must be running before attempting 'sync' action");
        }
        return new SpinnerPromise({
          promise: shell.runCommand(command, {
            cwd: source
          }),
          startMessage: "Syncing to " + destination + " on '" + appName + "'...",
          stopMessage: "Synced " + destination + " on '" + appName + "'."
        });
      });
    });
  };
  return Promise["try"](function() {
    if (before != null) {
      return shell.runCommand(before, source);
    }
  }).then(function() {
    return syncContainer(appName, destination, deviceIp).then(function() {
      return stopContainerSpinner(stopContainer(appName));
    }).then(function() {
      return startContainerSpinner(startContainer(appName));
    }).then(function() {
      if (after != null) {
        return shell.runCommand(after, source);
      }
    })["catch"](function(err) {
      return startContainerAfterErrorSpinner(startContainer(appName))["catch"](function(err) {
        return console.log('Could not start application container', err);
      })["finally"](function() {
        throw err;
      });
    });
  });
};
