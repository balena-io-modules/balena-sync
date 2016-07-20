m = require('mochainon')
_ = require('lodash')
fs = require('fs')
path = require('path')
os = require('os')
rsync = require('../lib/rsync')
mockFs = require('mock-fs')

filesystem = {}
filesystem['/.gitignore'] = '''
	npm-debug.log
	node_modules/
	lib/*
	!lib/include\\ me.txt
	# comment
	\\#notacomment
'''

assertCommand = (command, options) ->
	expected = 'rsync -az'

	if options.progress
		expected += ' --progress'

	expected += ' --rsh=\"ssh -p 22 -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlMaster=no test@ssh.resindevice.io rsync 1234 4567\"'
	expected += ' --delete'
	expected += ' --include=\"lib/include\\ me.txt\" --exclude=npm-debug.log --exclude=node_modules/ --exclude=lib/* --exclude=#notacomment'

	if options.ignore?
		expected += ' ' + _.map options.ignore, (pattern) ->
			return "--exclude=#{pattern}"
		.join(' ')

	expected += " . #{options.username}@ssh.resindevice.io:/usr/src/app/"

	m.chai.expect(command).to.equal(expected)

describe 'Rsync:', ->

	defaultOpts =
		username: 'test'
		uuid: '1234'
		source: '/'
		destination: '/usr/src/app/'
		containerId: '4567'

	beforeEach ->
		mockFs(filesystem)

	afterEach ->
		mockFs.restore()

	it 'should throw if progress is not a boolean', ->
		m.chai.expect ->
			rsync.getCommand(_.merge({}, defaultOpts, progress: 'true'))
		.to.throw('Not a boolean: progress')

	it 'should throw if ignore is not a string nor array', ->
		m.chai.expect ->
			rsync.getCommand(_.merge({}, defaultOpts, ignore: 1234))
		.to.throw('Not a string or array: ignore')

	it 'should be able to set progress to true', ->
		opts = _.merge({}, defaultOpts, progress: true)
		command = rsync.getCommand(opts)
		assertCommand(command, opts)

	it 'should be able to set progress to false', ->
		opts = _.merge({}, defaultOpts, progress: false)
		command = rsync.getCommand(opts)
		assertCommand(command, opts)

	it 'should be able to exclute a single pattern', ->
		opts = _.merge({}, defaultOpts, ignore: [ '.git' ])
		command = rsync.getCommand(opts)
		assertCommand(command, opts)

	it 'should be able to exclute a multiple patterns', ->
		opts = _.merge({}, defaultOpts, ignore: [ '.git', 'node_modules' ])
		command = rsync.getCommand(opts)
		assertCommand(command, opts)
