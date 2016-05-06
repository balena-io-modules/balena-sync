m = require('mochainon')
_ = require('lodash')
path = require('path')
os = require('os')
rsync = require('../lib/rsync')

assertCommand = (command, options) ->
	expected = 'rsync -az'

	if options.progress
		expected += ' --progress'

	expected += ' --rsh=\"ssh -p 22 -o LogLevel=QUIET -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null test@ssh.resindevice.io rsync 1234 4567\"'

	if options.exclude?
		expected += ' ' + _.map options.exclude, (pattern) ->
			return "--exclude=#{pattern}"
		.join(' ')

	expected += " . #{options.username}@ssh.resindevice.io:"

	m.chai.expect(command).to.equal(expected)

describe 'Rsync:', ->

	it 'should throw if progress is not a boolean', ->
		m.chai.expect ->
			rsync.getCommand
				username: 'test'
				uuid: '1234'
				containerId: '4567'
				progress: 'true'
		.to.throw('Not a boolean: progress')

	it 'should throw if ignore is not a string nor array', ->
		m.chai.expect ->
			rsync.getCommand
				username: 'test'
				uuid: '1234'
				containerId: '4567'
				ignore: 1234
		.to.throw('Not a string or array: ignore')

	it 'should be able to set progress to true', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			progress: true

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			progress: true

	it 'should be able to set progress to false', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			progress: false

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'

	it 'should be able to exclute a single pattern', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			ignore: '.git'

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			exclude: [ '.git' ]

	it 'should be able to exclute a multiple patterns', ->
		command = rsync.getCommand
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			ignore: [ '.git', 'node_modules' ]

		assertCommand command,
			username: 'test'
			uuid: '1234'
			containerId: '4567'
			exclude: [ '.git', 'node_modules' ]
