###
Copyright 2016 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

Promise = require('bluebird')
_ = require('lodash')
balena = require('balena-sdk').fromSharedOptions()
{ enumerateServices, findServices } = require('resin-discoverable-services')

# Although we only check for 'balena-ssh', we know, implicitly, that balenaOS
# devices come with 'rsync' installed that can be used over SSH.
avahiBalenaSshTag = 'resin-ssh'

exports.discoverLocalBalenaOsDevices = (timeout = 4000) ->
	enumerateServices()
	.then (availableServices) ->
		return (s.service for s in availableServices when avahiBalenaSshTag in s.tags)
	.then (services) ->
		if not services? or services.length is 0
			throw new Error("Could not find any available '#{avahiBalenaSshTag}' services")

		findServices(services, timeout)
	.then (services) ->
		_.map services, (service) ->

			# User referer address to get device IP. This will work fine assuming that
			# a device only advertises own services.
			{ referer: address: address, host, port } = service

			return { address, host, port }

# Resolves with array of remote online balena devices, throws on error
exports.getRemoteBalenaOnlineDevices = ->
	Promise.resolve(balena.models.device.getAll({ $filter: { is_online: true } }))
