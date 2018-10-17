m = require('mochainon')
path = require('path')
mockFs = require('mock-fs')
config = require('../lib/yaml-config')

describe 'Config:', ->

	describe '.getPath(baseDir)', ->

		it 'should be an absolute path', ->
			configPath = config.getPath('/tmp')
			m.chai.expect(path.isAbsolute(configPath)).to.be.true

		it 'should point to a yaml file', ->
			configPath = config.getPath('/tmp')
			m.chai.expect(path.extname(configPath)).to.equal('.yml')

	describe '.load(baseDir)', ->

		describe 'given the file contains valid yaml', ->

			it 'should return the parsed contents', ->
				filesystem = {}
				filesystem[config.getPath('/tmp')] = '''
					source: 'src/'
					before: 'echo Hello'
				'''
				mockFs(filesystem)

				options = config.load('/tmp')
				m.chai.expect(options).to.deep.equal
					source: 'src/'
					before: 'echo Hello'

				mockFs.restore()

		describe 'given the file contains invalid yaml', ->

			it 'should return the parsed contents', ->
				filesystem = {}
				filesystem[config.getPath('/tmp')] = '''
					1234
				'''
				mockFs(filesystem)

				m.chai.expect(-> config.load('/tmp')).to.throw("Invalid configuration file: #{config.getPath('/tmp')}")

				mockFs.restore()

		describe 'given the file does not exist', ->

			it 'should return an empty object', ->
				mockFs({})

				options = config.load('/tmp')
				m.chai.expect(options).to.deep.equal({})

				mockFs.restore()
