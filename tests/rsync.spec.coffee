m = require('mochainon')
_ = require('lodash')
fs = require('fs')
path = require('path')
os = require('os')
rsync = require('../lib/rsync')
mockFs = require('mock-fs')

filesystem = {}
filesystem[path.join(process.cwd(), '.gitignore')] = '''
	npm-debug.log
	node_modules/
'''

assertCommand = (command, options) ->
	expected = 'rsync -az'

	if options.progress
		expected += ' --progress'

	expected += ' --rsh=\"ssh -p 22 -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null test@ssh.resindevice.io rsync 1234 4567\" --delete-excluded --filter=\":- .gitignore\"'

	if options.exclude?
		expected += ' ' + _.map options.exclude, (pattern) ->
			return "--exclude=#{pattern}"
		.join(' ')

	expected += " . #{options.username}@ssh.resindevice.io:/usr/src/app/"

	m.chai.expect(command).to.equal(expected)

describe 'Rsync:', ->

	defaultOpts =
		username: 'test'
		uuid: '1234'
		source: '.'
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
		command = rsync.getCommand(_.merge({}, defaultOpts, progress: true))

		assertCommand(command, _.merge({}, defaultOpts, progress: true))

	it 'should be able to set progress to false', ->
		command = rsync.getCommand(_.merge({}, defaultOpts, progress: false))

		assertCommand(command, defaultOpts)

	it 'should be able to exclute a single pattern', ->
		command = rsync.getCommand(_.merge({}, defaultOpts, ignore: '.git'))

		assertCommand(command, _.merge({}, defaultOpts, exclude: [ '.git' ]))

	it 'should be able to exclute a multiple patterns', ->
		command = rsync.getCommand(_.merge({}, defaultOpts, ignore: [ '.git', 'node_modules' ]))

		assertCommand(command, _.merge({}, defaultOpts, exclude: [ '.git', 'node_modules' ]))
