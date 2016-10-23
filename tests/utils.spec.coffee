m = require('mochainon')
mockFs = require('mock-fs')
utils = require('../lib/utils')

describe 'Utils:', ->

	describe '.validateObject()', ->

		it 'should not throw if object is valid', ->
			m.chai.expect ->
				utils.validateObject
					foo: 'bar'
				,
					properties:
						foo:
							description: 'foo'
							type: 'string'
							required: true
			.to.not.throw(Error)

		it 'should throw if object is invalid', ->
			m.chai.expect ->
				utils.validateObject
					foo: 'bar'
				,
					properties:
						foo:
							description: 'foo'
							type: 'number'
							required: true
							message: 'Foo should be a number'
			.to.throw('Foo should be a number')

		it 'should throw the first error if object has multiple validation issues', ->
			m.chai.expect ->
				utils.validateObject
					foo: 'bar'
				,
					properties:
						foo:
							description: 'foo'
							type: 'number'
							required: true
							message: 'Foo should be a number'
						bar:
							description: 'bar'
							type: 'string'
							required: true
							message: 'Bar should be a string'
			.to.throw('Foo should be a number')

	describe 'fileExists()', ->
		filesystem =
			'package.json': 'package.json contents'
			'Dockerfile': 'Dockerfile contents'

		beforeEach ->
			mockFs(filesystem)

		afterEach ->
			mockFs.restore()

		it 'should return true if file exists', ->
			m.chai.expect(utils.fileExists('package.json')).to.be.true

		it 'should return false if file does not exist', ->
			m.chai.expect(utils.fileExists('test.json')).to.be.false
