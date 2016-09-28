###
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
###

syncTargets = [
	'remote-resin-io-device'
	'lan-resin-os-device'
]

module.exports = (target) ->

	if not target? or target not in syncTargets
		throw new Error("Invalid resin-sync target '#{target}'. Supported targets are: #{syncTargets}")

	console.log 'require'
	return require("./#{target}")
