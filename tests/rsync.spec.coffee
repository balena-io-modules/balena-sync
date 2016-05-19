m = require('mochainon')
_ = require('lodash')
path = require('path')
os = require('os')
rsync = require('../lib/rsync')

assertCommand = (command, options) ->
	expected = 'rsync -az'

	if options.progress
		expected += ' --progress'

	expected += ' --rsh=\"ssh -p 22 -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null test@ssh.resindevice.io rsync 1234 4567\"'

	if options.exclude?
		expected += ' ' + _.map options.exclude, (pattern) ->
			return "--exclude=#{pattern}"
		.join(' ')

	if os.platform() is 'win32' and options.source isnt '.'
		expected += " \"#{options.source}\""
	else
		expected += " #{options.source}"

	expected += " #{options.username}@ssh.resindevice.io:"

	m.chai.expect(command).to.equal(expected)

describe 'Rsync:', ->

	it 'should throw if source is not a string', ->
		m.chai.expect ->
			rsync.getCommand
				username: 'test'
				uuid: '1234'
				containerId: '4567'
				source: [ 'foo', 'bar' ]
		.to.throw('Not a string: source')

	it 'should throw if progress is not a boolean', ->
		m.chai.expect ->
			rsync.getCommand
				username: 'test'
				uuid: '1234'
				containerId: '4567'
				source: 'foo/bar'
				progress: 'true'
		.to.throw('Not a boolean: progress')

	it 'should throw if ignore is not a string nor array', ->
		m.chai.expect ->
			rsync.getCommand
				username: 'test'
				uuid: '1234'
				containerId: '4567'
				source: 'foo/bar'
				ignore: 1234
		.to.throw('Not a string or array: ignore')

	it 'should interpret an source containing only blank spaces as .', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: '      '

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: '.'

	it 'should automatically append a slash at the end of source', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: 'foo'

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}"

	it 'should not append a slash at the end of source is there is one already', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}"

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}"

	it 'should be able to set progress to true', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			progress: true

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			progress: true

	it 'should be able to set progress to false', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			progress: false

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"

	it 'should be able to exclute a single pattern', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			ignore: '.git'

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			exclude: [ '.git' ]

	it 'should be able to exclute a multiple patterns', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			ignore: [ '.git', 'node_modules' ]

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			source: "foo#{path.sep}bar#{path.sep}"
			exclude: [ '.git', 'node_modules' ]
