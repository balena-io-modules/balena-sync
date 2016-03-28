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

_ = require('lodash')
revalidator = require('revalidator')

###*
# @summary Validate object
# @function
# @protected
#
# @param {Object} object - input object
# @param {Object} rules - validation rules
#
# @throws Will throw if object is invalid
#
# @example
# utils.validateObject
# 	foo: 'bar'
# ,
# 	properties:
# 		foo:
# 			description: 'foo'
# 			type: 'string'
# 			required: true
###
exports.validateObject = (object, rules) ->
	validation = revalidator.validate(object, rules)

	if not validation.valid
		error = _.first(validation.errors)
		throw new Error(error.message)
