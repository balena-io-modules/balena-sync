import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as _ from 'lodash';
import * as rsync from '../lib/rsync';
import * as mockFs from 'mock-fs';

chai.use(chaiAsPromised);
const { expect } = chai;

const filesystem = {
	['/.gitignore']: [
		'npm-debug.log',
		'node_modules/',
		'lib/*',
		'!lib/include with space.txt',
		'!lib/include with space.txt',
		'!lib/include with space trail.txt\\ ',
		'# comment',
		'\\#notacomment',
	].join('\n'),
};

const assertCommand = function (
	command: string,
	options: Parameters<typeof rsync.buildRsyncCommand>[0] = {},
) {
	let expected = 'rsync -az';

	if (options.progress) {
		expected += ' --progress';
	}

	expected +=
		' --rsh="ssh -p 22 -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"';
	expected += ' --delete';

	expected += ' --rsync-path="\\$(which rsync) 1234 4567"';

	expected +=
		' --include="lib/include with space.txt" --include="lib/include with space trail.txt "';
	expected +=
		' --exclude=npm-debug.log --exclude=node_modules/ --exclude=lib/* --exclude=#notacomment';

	if (options.ignore != null) {
		expected +=
			' ' +
			_.map(options.ignore, (pattern) => `--exclude=${pattern}`).join(' ');
	}

	// node-rsync@0.4.0 bug - the single quote should normally not be escaped since it appears inside double quotes
	expected +=
		' . "test@ssh.balena-devices.com:/usr/src/app/a/b/\\` \\\' @ ! \\$test \\" end"';

	return expect(command).to.equal(expected);
};

describe('Rsync:', function () {
	const defaultOpts = {
		username: 'test',
		source: '/',
		destination: '/usr/src/app/a/b/` \' @ ! $test " end',
		port: 22,
		host: 'ssh.balena-devices.com',
		rsyncPath: '$(which rsync) 1234 4567',
	};

	beforeEach(() => mockFs(filesystem));

	afterEach(() => mockFs.restore());

	it('should throw if progress is not a boolean', () =>
		expect(() =>
			rsync.buildRsyncCommand(
				_.merge({}, defaultOpts, { progress: 'true' }) as any,
			),
		).to.throw('Not a boolean: progress'));

	it('should throw if ignore is not a string nor array', () =>
		expect(() =>
			rsync.buildRsyncCommand(
				_.merge({}, defaultOpts, { ignore: 1234 }) as any,
			),
		).to.throw('Not a string or array: ignore'));

	it('should be able to set progress to true', function () {
		const opts = _.merge({}, defaultOpts, { progress: true });
		const command = rsync.buildRsyncCommand(opts);
		return assertCommand(command, opts);
	});

	it('should be able to set progress to false', function () {
		const opts = _.merge({}, defaultOpts, { progress: false });
		const command = rsync.buildRsyncCommand(opts);
		return assertCommand(command, opts);
	});

	it('should be able to exclude a single pattern', function () {
		const opts = _.merge({}, defaultOpts, { ignore: ['.git'] });
		const command = rsync.buildRsyncCommand(opts);
		return assertCommand(command, opts);
	});

	return it('should be able to exclude a multiple patterns', function () {
		const opts = _.merge({}, defaultOpts, { ignore: ['.git', 'node_modules'] });
		const command = rsync.buildRsyncCommand(opts);
		return assertCommand(command, opts);
	});
});
