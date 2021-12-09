import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import * as os from 'os';
import * as shell from '../lib/shell';
import * as sinon from 'sinon';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Shell:', function () {
	describe('.getSubShellCommand()', function () {
		describe('given windows', function () {
			beforeEach(function () {
				this.osPlatformStub = sinon.stub(os, 'platform');
				return this.osPlatformStub.returns('win32');
			});

			afterEach(function () {
				return this.osPlatformStub.restore();
			});

			it('should set program to cmd.exe', function () {
				const subshell = shell.getSubShellCommand('foo');
				return expect(subshell.program).to.equal('cmd.exe');
			});

			return it('should set the correct sh arguments', function () {
				const subshell = shell.getSubShellCommand('foo');
				return expect(subshell.args).to.deep.equal(['/s', '/c', 'foo']);
			});
		});

		return describe('given not windows', function () {
			beforeEach(function () {
				this.osPlatformStub = sinon.stub(os, 'platform');
				return this.osPlatformStub.returns('linux');
			});

			afterEach(function () {
				return this.osPlatformStub.restore();
			});

			it('should set program to /bin/sh', function () {
				const subshell = shell.getSubShellCommand('foo');
				return expect(subshell.program).to.equal('/bin/sh');
			});

			return it('should set the correct /bin/sh arguments', function () {
				const subshell = shell.getSubShellCommand('foo');
				return expect(subshell.args).to.deep.equal(['-c', 'foo']);
			});
		});
	});

	return describe('.runCommand()', function () {
		describe('given a spawn that emits an error', function () {
			beforeEach(function () {
				this.childProcessSpawnStub = sinon.stub(child_process, 'spawn');

				const spawn = new EventEmitter();
				setTimeout(() => spawn.emit('error', 'spawn error'), 5);

				return this.childProcessSpawnStub.returns(spawn);
			});

			afterEach(function () {
				return this.childProcessSpawnStub.restore();
			});

			return it('should be rejected with an error', function () {
				const promise = shell.runCommand('echo foo', '.');
				return expect(promise).to.be.rejectedWith('spawn error');
			});
		});

		describe('given a spawn that closes with an error code', function () {
			beforeEach(function () {
				this.childProcessSpawnStub = sinon.stub(child_process, 'spawn');

				const spawn = new EventEmitter();
				setTimeout(() => spawn.emit('close', 1), 5);

				return this.childProcessSpawnStub.returns(spawn);
			});

			afterEach(function () {
				return this.childProcessSpawnStub.restore();
			});

			return it('should be rejected with an error', function () {
				const promise = shell.runCommand('echo foo', '.');
				return expect(promise).to.be.rejectedWith(
					'Child process exited with code 1',
				);
			});
		});

		return describe('given a spawn that closes with a zero code', function () {
			beforeEach(function () {
				this.childProcessSpawnStub = sinon.stub(child_process, 'spawn');

				const spawn = new EventEmitter();
				setTimeout(() => spawn.emit('close', 0), 5);

				return this.childProcessSpawnStub.returns(spawn);
			});

			afterEach(function () {
				return this.childProcessSpawnStub.restore();
			});

			it('should be resolved', function () {
				const promise = shell.runCommand('echo foo', '.');
				return expect(promise).to.eventually.be.undefined;
			});

			describe('given windows', function () {
				beforeEach(function () {
					this.osPlatformStub = sinon.stub(os, 'platform');
					return this.osPlatformStub.returns('win32');
				});

				afterEach(function () {
					return this.osPlatformStub.restore();
				});

				return it('should call spawn with the correct arguments', function () {
					shell.runCommand('echo foo', '.');
					const { args } = this.childProcessSpawnStub.firstCall;
					expect(args[0]).to.equal('cmd.exe');
					return expect(args[1]).to.deep.equal(['/s', '/c', 'echo foo']);
				});
			});

			return describe('given not windows', function () {
				beforeEach(function () {
					this.osPlatformStub = sinon.stub(os, 'platform');
					return this.osPlatformStub.returns('linux');
				});

				afterEach(function () {
					return this.osPlatformStub.restore();
				});

				return it('should call spawn with the correct arguments', function () {
					shell.runCommand('echo foo');
					const { args } = this.childProcessSpawnStub.firstCall;
					expect(args[0]).to.equal('/bin/sh');
					return expect(args[1]).to.deep.equal(['-c', 'echo foo']);
				});
			});
		});
	});
});
