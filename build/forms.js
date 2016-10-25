var Promise, SpinnerPromise, _, discoverLocalResinOsDevices, form;

Promise = require('bluebird');

_ = require('lodash');

form = require('resin-cli-form');

discoverLocalResinOsDevices = require('./discover').discoverLocalResinOsDevices;

SpinnerPromise = require('resin-cli-visuals').SpinnerPromise;

exports.selectAppName = function(preferredAppName) {
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
  }).get('appname').call('trim').then(validateAppName);
};

exports.selectSyncDestination = function(preferredDestination) {
  return form.run([
    {
      message: 'Destination directory on device container [/usr/src/app]',
      name: 'destination',
      type: 'input'
    }
  ], {
    override: {
      destination: preferredDestination
    }
  }).get('destination').then(function(destination) {
    return destination != null ? destination : '/usr/src/app';
  });
};

exports.selectLocalResinOsDevice = function(timeout) {
  if (timeout == null) {
    timeout = 4000;
  }
  return new SpinnerPromise({
    promise: discoverLocalResinOsDevices(timeout),
    startMessage: 'Discovering local resinOS devices..',
    stopMessage: 'Reporting discovered devices'
  }).then(function(devices) {
    if (_.isEmpty(devices)) {
      throw new Error('Could not find any local resinOS devices');
    }
    return form.ask({
      message: 'select a device',
      type: 'list',
      "default": devices[0].ip,
      choices: _.map(devices, function(device) {
        return {
          name: (device.host || 'untitled') + " (" + device.address + ")",
          value: device.address
        };
      })
    });
  });
};
