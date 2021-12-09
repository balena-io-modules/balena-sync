import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as _ from 'lodash';
import * as mockFs from 'mock-fs';
import {
	getFileHash,
	createBuildTriggerHashes,
	checkTriggers,
} from '../lib/build-trigger';

chai.use(chaiAsPromised);
const { expect } = chai;

const filesystem = {
	'package.json': 'package.json contents',
	Dockerfile: 'Dockerfile contents',
};

const savedBuildTriggers = [
	{
		'package.json':
			'e2c193459707068888808a4e89c745162ed4e24bc093ac72f0009f5f15992cbb',
	},
	{
		Dockerfile:
			'f6aca399ab7883e1ebdf61b6d22756df83626409f824c0f6d80c2148478769b2',
	},
];

describe('build-trigger', function () {
	beforeEach(() => mockFs(filesystem));

	afterEach(() => mockFs.restore());

	describe('getFileHash()', () =>
		it('should resolve with the correct hash', () =>
			expect(getFileHash('package.json')).to.eventually.equal(
				savedBuildTriggers[0]['package.json'],
			)));

	describe('createBuildTriggerHashes()', function () {
		it('should return file hashes', () =>
			createBuildTriggerHashes({ files: _.keys(filesystem) }).then((hashes) =>
				expect(hashes).to.deep.equal(savedBuildTriggers),
			));

		it("should return a single hash entry for 'Dockerfile', './Dockerfile' and '/full/path/Dockerfile'", function () {
			const files = _.keys(filesystem);
			files.push('./Dockerfile');
			files.push(path.join(process.cwd(), 'Dockerfile'));

			return createBuildTriggerHashes({ files }).then((hashes) =>
				expect(hashes).to.deep.equal(savedBuildTriggers),
			);
		});

		it('should return file hashes if a file is missing and skipMissing is set to true (default)', function () {
			const files = _.keys(filesystem);
			files.push('test.json');

			return createBuildTriggerHashes({ files }).then((hashes) =>
				expect(hashes).to.deep.equal(savedBuildTriggers),
			);
		});

		return it('should throw if file is missing and skipMissing is set to false', function () {
			const files = _.keys(filesystem);
			files.push('test.json');

			return expect(
				createBuildTriggerHashes({ files, skipMissing: false }),
			).to.be.rejectedWith('Could not calculate hash - File does not exist');
		});
	});

	return describe('checkTriggers()', function () {
		it('should resolve with true if a file is missing', function () {
			mockFs(_.omit(filesystem, 'Dockerfile'));

			return expect(
				checkTriggers(savedBuildTriggers as any),
			).to.eventually.equal(true);
		});

		it('should resolve with true if a file has changed', function () {
			mockFs(_.assign({}, filesystem, { 'package.json': 'edited file' }));

			return expect(
				checkTriggers(savedBuildTriggers as any),
			).to.eventually.equal(true);
		});

		return it('should resolve with false if no file has changed', () =>
			expect(checkTriggers(savedBuildTriggers as any)).to.eventually.equal(
				false,
			));
	});
});
