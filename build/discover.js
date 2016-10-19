
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
var SpinnerPromise, _, avahiResinSshTag, enumerateServices, findServices, form, ref, resin,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

_ = require('lodash');

resin = require('resin-sdk');

ref = require('resin-discoverable-services'), enumerateServices = ref.enumerateServices, findServices = ref.findServices;

form = require('resin-cli-form');

SpinnerPromise = require('resin-cli-visuals').SpinnerPromise;

avahiResinSshTag = 'resin-ssh';

exports.discoverLocalResinOsDevices = function(timeout) {
  if (timeout == null) {
    timeout = 4000;
  }
  return enumerateServices().then(function(availableServices) {
    var s;
    return (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = availableServices.length; i < len; i++) {
        s = availableServices[i];
        if (indexOf.call(s.tags, avahiResinSshTag) >= 0) {
          results.push(s.service);
        }
      }
      return results;
    })();
  }).then(function(services) {
    if ((services == null) || services.length === 0) {
      throw new Error("Could not find any available '" + avahiResinSshTag + "' services");
    }
    return findServices(services, timeout);
  }).then(function(services) {
    return _.map(services, function(service) {
      var address, host, port, ref1;
      (ref1 = service.referer, address = ref1.address), host = service.host, port = service.port;
      return {
        address: address,
        host: host,
        port: port
      };
    });
  });
};

exports.selectLocalResinOsDeviceForm = function(timeout) {
  if (timeout == null) {
    timeout = 4000;
  }
  return new SpinnerPromise({
    promise: exports.discoverLocalResinOsDevices(),
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

exports.getRemoteResinioOnlineDevices = function() {
  return resin.models.device.getAll().filter(function(device) {
    return device.is_online;
  });
};
