m = require('mochainon')
ssh = require('../lib/ssh')

describe 'SSH:', ->

	describe '.getConnectCommand()', ->

		describe 'given no options', ->

			it 'should return a standard command', ->
				command = ssh.getConnectCommand
				m.chai.expect(command).to.throw(Error)

		describe 'given the required options', ->

			it 'should build a correct rsync --rsh command', ->
				command = ssh.getConnectCommand
					username: 'test'
					uuid: '1234'
					containerId: '4567'
					port: 8080

				m.chai.expect(command).to.equal('ssh -p 8080 -o LogLevel=QUIET -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null test@ssh.resindevice.io rsync 1234 4567')
