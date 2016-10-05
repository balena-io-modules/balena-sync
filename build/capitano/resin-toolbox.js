
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
  signature: 'deploy [deviceIp]',
  description: 'Deploy your changes to a container on local ResinOS device ',
  help: 'WARNING: If you\'re running Windows, this command only supports `cmd.exe`.\n\nUse this command to deploy your local changes to a container on a LAN-accessible resinOS device on the fly.\nIf `Dockerfile` or any build-trigger file is changed, a new container will be built and run on your device.\nIf not, changes will simply be synced with `rsync` into the application container.\n\nAfter every \'resin deploy\' the updated settings will be saved in\n\'<source>/.resin-sync.yml\' and will be used in later invocations. You can\nalso change any option by editing \'.resin-sync.yml\' directly.\n\nHere is an example \'.resin-sync.yml\' :\n\n	$ cat $PWD/.resin-sync.yml\n	destination: \'/usr/src/app\'\n	before: \'echo Hello\'\n	after: \'echo Done\'\n	ignore:\n		- .git\n		- node_modules/\n\nCommand line options have precedence over the ones saved in \'.resin-sync.yml\'.\n\nIf \'.gitignore\' is found in the source directory then all explicitly listed files will be\nexcluded when using rsync to update the container. You can choose to change this default behavior with the\n\'--skip-gitignore\' option.\n\nExamples:\n\n	$ rtb deploy\n	$ rtb deploy --ignore lib/\n	$ rtb deploy --verbose false\n	$ rtb deploy 192.168.2.10 --source . --destination /usr/src/app\n	$ rtb deploy 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before \'echo Hello\' --after \'echo Done\'',
  primary: true,
  options: [
    {
      signature: 'source',
      parameter: 'path',
      description: 'root of project directory to deploy to device container',
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
      description: 'execute a command before deploying',
      alias: 'b'
    }, {
      signature: 'after',
      parameter: 'command',
      description: 'execute a command after deploying',
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
    var Promise, findAvahiDevices, form, getSyncOptions, save, selectLocalResinOSDevice, sync, _;
    Promise = require('bluebird');
    _ = require('lodash');
    form = require('resin-cli-form');
    save = require('../config').save;
    findAvahiDevices = require('../discover').findAvahiDevices;
    getSyncOptions = require('../utils').getSyncOptions;
    sync = require('../sync')('local-resin-os-device').sync;
    selectLocalResinOSDevice = function() {
      return findAvahiDevices().then(function(devices) {
        if (_.isEmpty(devices)) {
          throw new Error('You don\'t have any local ResinOS devices');
        }
        return form.ask({
          message: 'Select a device',
          type: 'list',
          "default": devices[0].ip,
          choices: _.map(devices, function(device) {
            return {
              name: "" + (device.name || 'Untitled') + " (" + device.ip + ")",
              value: device.ip
            };
          })
        });
      });
    };
    return Promise["try"](function() {
      return getSyncOptions(options).then((function(_this) {
        return function(syncOptions) {
          _this.syncOptions = syncOptions;
          if (params.deviceIp == null) {
            return selectLocalResinOSDevice();
          }
          return params.deviceIp;
        };
      })(this)).then(function(deviceIp) {
        _.assign(this.syncOptions, {
          deviceIp: deviceIp
        });
        _.defaults(this.syncOptions, {
          port: 22222
        });
        return save(_.omit(this.syncOptions, ['source', 'verbose', 'progress', 'deviceIp']), this.syncOptions.source);
      }).then((function(_this) {
        return function() {
          console.log("Attempting to sync to /dev/null on device " + _this.syncOptions.deviceIp);
          return sync(_this.syncOptions);
        };
      })(this));
    }).nodeify(done);
  }
};
