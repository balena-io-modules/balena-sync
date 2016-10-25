
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
  signature: 'sync [uuid]',
  description: '(beta) sync your changes to a device',
  help: 'WARNING: If you\'re running Windows, this command only supports `cmd.exe`.\n\nUse this command to sync your local changes to a certain device on the fly.\n\nAfter every \'resin sync\' the updated settings will be saved in\n\'<source>/.resin-sync.yml\' and will be used in later invocations. You can\nalso change any option by editing \'.resin-sync.yml\' directly.\n\nHere is an example \'.resin-sync.yml\' :\n\n	$ cat $PWD/.resin-sync.yml\n	uuid: 7cf02a6\n	destination: \'/usr/src/app\'\n	before: \'echo Hello\'\n	after: \'echo Done\'\n	ignore:\n		- .git\n		- node_modules/\n\nCommand line options have precedence over the ones saved in \'.resin-sync.yml\'.\n\nIf \'.gitignore\' is found in the source directory then all explicitly listed files will be\nexcluded from the syncing process. You can choose to change this default behavior with the\n\'--skip-gitignore\' option.\n\nExamples:\n\n	$ resin sync 7cf02a6 --source . --destination /usr/src/app\n	$ resin sync 7cf02a6 -s /home/user/myResinProject -d /usr/src/app --before \'echo Hello\' --after \'echo Done\'\n	$ resin sync --ignore lib/\n	$ resin sync --verbose false\n	$ resin sync',
  permission: 'user',
  primary: true,
  options: [
    {
      signature: 'source',
      parameter: 'path',
      description: 'local directory path to synchronize to device',
      alias: 's'
    }, {
      signature: 'destination',
      parameter: 'path',
      description: 'destination path on device',
      alias: 'd'
    }, {
      signature: 'ignore',
      parameter: 'paths',
      description: 'comma delimited paths to ignore when syncing',
      alias: 'i'
    }, {
      signature: 'skip-gitignore',
      boolean: true,
      description: 'do not parse excluded/included files from .gitignore'
    }, {
      signature: 'before',
      parameter: 'command',
      description: 'execute a command before syncing',
      alias: 'b'
    }, {
      signature: 'after',
      parameter: 'command',
      description: 'execute a command after syncing',
      alias: 'a'
    }, {
      signature: 'port',
      parameter: 'port',
      description: 'ssh port',
      alias: 't'
    }, {
      signature: 'progress',
      boolean: true,
      description: 'show progress',
      alias: 'p'
    }, {
      signature: 'verbose',
      boolean: true,
      description: 'increase verbosity',
      alias: 'v'
    }
  ],
  action: function(params, options, done) {
    var Promise, _, configYml, ensureDeviceIsOnline, form, getRemoteResinioOnlineDevices, parseOptions, ref, ref1, runtimeOptions, selectOnlineDevice, selectSyncDestination, sync, yamlConfig;
    Promise = require('bluebird');
    _ = require('lodash');
    form = require('resin-cli-form');
    yamlConfig = require('../yaml-config');
    parseOptions = require('./parse-options');
    getRemoteResinioOnlineDevices = require('../discover').getRemoteResinioOnlineDevices;
    selectSyncDestination = require('../forms').selectSyncDestination;
    ref = require('../sync')('remote-resin-io-device'), sync = ref.sync, ensureDeviceIsOnline = ref.ensureDeviceIsOnline;
    selectOnlineDevice = function() {
      return getRemoteResinioOnlineDevices().then(function(onlineDevices) {
        if (_.isEmpty(onlineDevices)) {
          throw new Error('You don\'t have any devices online');
        }
        return form.ask({
          message: 'Select a device',
          type: 'list',
          "default": onlineDevices[0].uuid,
          choices: _.map(onlineDevices, function(device) {
            return {
              name: (device.name || 'Untitled') + " (" + (device.uuid.slice(0, 7)) + ")",
              value: device.uuid
            };
          })
        });
      });
    };
    ref1 = parseOptions(options, params), runtimeOptions = ref1.runtimeOptions, configYml = ref1.configYml;
    return Promise["try"](function() {
      if (params != null ? params.uuid : void 0) {
        return ensureDeviceIsOnline(params.uuid);
      }
      if (configYml.uuid != null) {
        return ensureDeviceIsOnline(configYml.uuid)["catch"](function() {
          console.log("Device " + configYml.uuid + " not found or is offline.");
          return selectOnlineDevice();
        });
      } else {
        return selectOnlineDevice();
      }
    }).then(function(uuid) {
      runtimeOptions.uuid = uuid;
      return selectSyncDestination(runtimeOptions.destination);
    }).then(function(destination) {
      var notNil;
      runtimeOptions.destination = destination;
      notNil = function(val) {
        return !_.isNil(val);
      };
      return yamlConfig.save(_.assign({}, configYml, _(runtimeOptions).pick(['uuid', 'destination', 'ignore', 'before', 'after']).pickBy(notNil).value()), configYml.baseDir);
    }).then(function() {
      return sync(_.pick(runtimeOptions, ['uuid', 'baseDir', 'appName', 'destination', 'before', 'after', 'progress', 'verbose', 'skipGitignore', 'ignore']));
    }).nodeify(done);
  }
};
