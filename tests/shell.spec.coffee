m = require('mochainon')
EventEmitter = require('events').EventEmitter
child_process = require('child_process')
os = require('os')
shell = require('../lib/shell')

describe 'Shell:', ->

	describe '.getSubShellCommand()', ->

		describe 'given windows', ->

			beforeEach ->
				@osPlatformStub = m.sinon.stub(os, 'platform')
				@osPlatformStub.returns('win32')

			afterEach ->
				@osPlatformStub.restore()

			it 'should set program to sh', ->
				subshell = shell.getSubShellCommand('foo')
				m.chai.expect(subshell.program).to.equal('sh')

			it 'should set the correct sh arguments', ->
				subshell = shell.getSubShellCommand('foo')
				m.chai.expect(subshell.args).to.deep.equal([ '-c', 'foo' ])

			it 'should surround a multiple word command in double quotes', ->
				subshell = shell.getSubShellCommand('foo bar baz')
				m.chai.expect(subshell.args).to.deep.equal([ '-c', 'foo bar baz' ])

		describe 'given not windows', ->

			beforeEach ->
				@osPlatformStub = m.sinon.stub(os, 'platform')
				@osPlatformStub.returns('linux')

			afterEach ->
				@osPlatformStub.restore()

			it 'should set program to /bin/sh', ->
				subshell = shell.getSubShellCommand('foo')
				m.chai.expect(subshell.program).to.equal('/bin/sh')

			it 'should set the correct /bin/sh arguments', ->
				subshell = shell.getSubShellCommand('foo')
				m.chai.expect(subshell.args).to.deep.equal([ '-c', 'foo' ])

	describe '.runCommand()', ->

		describe 'given a spawn that emits an error', ->

			beforeEach ->
				@childProcessSpawnStub = m.sinon.stub(child_process, 'spawn')

				spawn = new EventEmitter()
				setTimeout ->
					spawn.emit('error', 'spawn error')
				, 5

				@childProcessSpawnStub.returns(spawn)

			afterEach ->
				@childProcessSpawnStub.restore()

			it 'should be rejected with an error', ->
				promise = shell.runCommand('echo foo')
				m.chai.expect(promise).to.be.rejectedWith('spawn error')

		describe 'given a spawn that closes with an error code', ->

			beforeEach ->
				@childProcessSpawnStub = m.sinon.stub(child_process, 'spawn')

				spawn = new EventEmitter()
				setTimeout ->
					spawn.emit('close', 1)
				, 5

				@childProcessSpawnStub.returns(spawn)

			afterEach ->
				@childProcessSpawnStub.restore()

			it 'should be rejected with an error', ->
				promise = shell.runCommand('echo foo')
				m.chai.expect(promise).to.be.rejectedWith('Child process exited with code 1')

		describe 'given a spawn that closes with a zero code', ->

			beforeEach ->
				@childProcessSpawnStub = m.sinon.stub(child_process, 'spawn')

				spawn = new EventEmitter()
				setTimeout ->
					spawn.emit('close', 0)
				, 5

				@childProcessSpawnStub.returns(spawn)

			afterEach ->
				@childProcessSpawnStub.restore()

			it 'should be resolved', ->
				promise = shell.runCommand('echo foo')
				m.chai.expect(promise).to.eventually.be.undefined

			describe 'given windows', ->

				beforeEach ->
					@osPlatformStub = m.sinon.stub(os, 'platform')
					@osPlatformStub.returns('win32')

				afterEach ->
					@osPlatformStub.restore()

				it 'should call spawn with the correct arguments', ->
					shell.runCommand('echo foo')
					args = @childProcessSpawnStub.firstCall.args
					m.chai.expect(args[0]).to.equal('sh')
					m.chai.expect(args[1]).to.deep.equal([ '-c', 'echo foo' ])

			describe 'given not windows', ->

				beforeEach ->
					@osPlatformStub = m.sinon.stub(os, 'platform')
					@osPlatformStub.returns('linux')

				afterEach ->
					@osPlatformStub.restore()

				it 'should call spawn with the correct arguments', ->
					shell.runCommand('echo foo')
					args = @childProcessSpawnStub.firstCall.args
					m.chai.expect(args[0]).to.equal('/bin/sh')
					m.chai.expect(args[1]).to.deep.equal([ '-c', 'echo foo' ])
