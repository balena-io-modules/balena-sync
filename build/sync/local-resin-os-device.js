
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
var Promise, chalk;

Promise = require('bluebird');

chalk = require('chalk');

exports.sync = function(syncOptions) {
  return Promise["try"](function() {
    console.log('Syncing...');
    return console.log(chalk.green.bold('sync succeeded'));
  })["catch"](function(err) {
    console.log(chalk.red.bold('sync failed.', err));
    return process.exit(1);
  });
};
