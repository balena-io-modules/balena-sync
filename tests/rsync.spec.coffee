m = require('mochainon')
_ = require('lodash')
rsync = require('../lib/rsync')
mockFs = require('mock-fs')

filesystem = {}
filesystem['/.gitignore'] = '''
	npm-debug.log
	node_modules/
	lib/*
	!lib/include with space.txt
	!lib/include\ with\ space.txt
	!lib/include with space trail.txt\\ 
	# comment
	\\#notacomment
'''

assertCommand = (command, options) ->
	expected = 'rsync -az'

	if options.progress
		expected += ' --progress'

	expected += ' --rsh=\"ssh -p 22 -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null\"'
	expected += ' --delete'

	expected += ' --rsync-path=\"\\$(which rsync) 1234 4567\"'

	expected += ' --include=\"lib/include with space.txt\" --include=\"lib/include with space trail.txt \"'
	expected += ' --exclude=npm-debug.log --exclude=node_modules/ --exclude=lib/* --exclude=#notacomment'

	if options.ignore?
		expected += ' ' + _.map options.ignore, (pattern) ->
			return "--exclude=#{pattern}"
		.join(' ')

	# node-rsync@0.4.0 bug - the single quote should normally not be escaped since it appears inside double quotes
	expected += " . \"test@ssh.balena-devices.com:/usr/src/app/a/b/\\` \\' @ ! \\$test \\\" end\""

	m.chai.expect(command).to.equal(expected)

describe 'Rsync:', ->

	defaultOpts =
		username: 'test'
		source: '/'
		destination: "/usr/src/app/a/b/` ' @ ! $test \" end"
		port: 22
		host: 'ssh.balena-devices.com'
		rsyncPath: '$(which rsync) 1234 4567'

	beforeEach ->
		mockFs(filesystem)

	afterEach ->
		mockFs.restore()

	it 'should throw if progress is not a boolean', ->
		m.chai.expect ->
			rsync.buildRsyncCommand(_.merge({}, defaultOpts, progress: 'true'))
		.to.throw('Not a boolean: progress')

	it 'should throw if ignore is not a string nor array', ->
		m.chai.expect ->
			rsync.buildRsyncCommand(_.merge({}, defaultOpts, ignore: 1234))
		.to.throw('Not a string or array: ignore')

	it 'should be able to set progress to true', ->
		opts = _.merge({}, defaultOpts, progress: true)
		command = rsync.buildRsyncCommand(opts)
		assertCommand(command, opts)

	it 'should be able to set progress to false', ->
		opts = _.merge({}, defaultOpts, progress: false)
		command = rsync.buildRsyncCommand(opts)
		assertCommand(command, opts)

	it 'should be able to exclute a single pattern', ->
		opts = _.merge({}, defaultOpts, ignore: [ '.git' ])
		command = rsync.buildRsyncCommand(opts)
		assertCommand(command, opts)

	it 'should be able to exclute a multiple patterns', ->
		opts = _.merge({}, defaultOpts, ignore: [ '.git', 'node_modules' ])
		command = rsync.buildRsyncCommand(opts)
		assertCommand(command, opts)
