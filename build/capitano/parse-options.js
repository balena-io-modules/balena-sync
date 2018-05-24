// Generated by CoffeeScript 1.12.7
var _, defaultSyncIgnorePaths, fileExists, path, ref, validateEnvVar, yamlConfig;

path = require('path');

_ = require('lodash');

yamlConfig = require('../yaml-config');

ref = require('../utils'), fileExists = ref.fileExists, validateEnvVar = ref.validateEnvVar;

defaultSyncIgnorePaths = ['.git', 'node_modules/'];


/**
 * @summary Parse resin sync options from the cli and config file and give precedence to the cli.
 * @function
 *
 * @param {Object} cliOptions - options
 * @param {String} cliParams - parameters
 *
 * @returns {Object} parsedOptions
 * @returns {Object} parsedOptions.configYml - the loaded config file (i.e. 'resin-sync.yml')
 * @returns {Object} parsedOptions.options - the parsed options
 * @throws Exception on error
 *
 */

module.exports = function(cliOptions, cliParams) {
  var configYml, file, ignoreFiles, projectBaseDir, ref1, ref10, ref11, ref12, ref13, ref14, ref15, ref16, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, savedBuildTriggerFiles, savedBuildTriggers, trigger;
  if (cliOptions == null) {
    cliOptions = {};
  }
  if (cliParams == null) {
    cliParams = {};
  }
  projectBaseDir = cliOptions['source'] ? path.resolve(cliOptions['source']) : process.cwd();
  if ((cliOptions['source'] == null) && !fileExists(path.join(process.cwd(), yamlConfig.CONFIG_FILE))) {
    throw new Error("No --source option passed and no \'" + yamlConfig.CONFIG_FILE + "\' file found in current directory.");
  }
  configYml = yamlConfig.load(projectBaseDir);
  if (configYml['local_resinos'] == null) {
    configYml['local_resinos'] = {};
  }
  if (cliOptions['build-triggers'] != null) {
    cliOptions['build-triggers'] = cliOptions['build-triggers'].split(',');
  }
  savedBuildTriggers = (ref1 = configYml['local_resinos']['build-triggers']) != null ? ref1 : [];
  savedBuildTriggerFiles = _.flatten((function() {
    var i, len, results;
    results = [];
    for (i = 0, len = savedBuildTriggers.length; i < len; i++) {
      trigger = savedBuildTriggers[i];
      results.push((function() {
        var results1;
        results1 = [];
        for (file in trigger) {
          results1.push(file);
        }
        return results1;
      })());
    }
    return results;
  })());
  if (cliOptions['ignore'] != null) {
    cliOptions['ignore'] = cliOptions['ignore'].split(',');
  }
  ignoreFiles = (ref2 = (ref3 = cliOptions['ignore']) != null ? ref3 : configYml['ignore']) != null ? ref2 : defaultSyncIgnorePaths;
  ignoreFiles = _.filter(ignoreFiles, function(item) {
    return !_.isEmpty(item);
  });
  return {
    configYml: configYml,
    runtimeOptions: {
      baseDir: projectBaseDir,
      deviceIp: cliParams['deviceIp'],
      appName: (ref4 = cliOptions['app-name']) != null ? ref4 : configYml['local_resinos']['app-name'],
      destination: (ref5 = cliOptions['destination']) != null ? ref5 : configYml['destination'],
      before: (ref6 = cliOptions['before']) != null ? ref6 : configYml['before'],
      after: (ref7 = cliOptions['after']) != null ? ref7 : configYml['after'],
      progress: (ref8 = cliOptions['progress']) != null ? ref8 : false,
      verbose: (ref9 = cliOptions['verbose']) != null ? ref9 : false,
      skipRestart: (ref10 = cliOptions['skip-restart']) != null ? ref10 : false,
      skipGitignore: (ref11 = cliOptions['skip-gitignore']) != null ? ref11 : false,
      ignore: ignoreFiles,
      skipLogs: (ref12 = cliOptions['skip-logs']) != null ? ref12 : false,
      forceBuild: (ref13 = cliOptions['force-build']) != null ? ref13 : false,
      buildTriggerFiles: (ref14 = cliOptions['build-triggers']) != null ? ref14 : savedBuildTriggerFiles,
      savedBuildTriggerFiles: savedBuildTriggerFiles,
      uuid: cliParams['uuid'],
      port: (ref15 = cliOptions['port']) != null ? ref15 : configYml['port'],
      env: validateEnvVar((ref16 = cliOptions['env']) != null ? ref16 : configYml['local_resinos']['environment'])
    }
  };
};
