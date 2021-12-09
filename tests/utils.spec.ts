import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as mockFs from 'mock-fs';
import * as utils from '../lib/utils';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Utils:', function () {
	describe('.validateObject()', function () {
		it('should not throw if object is valid', () =>
			expect(() =>
				utils.validateObject(
					{ foo: 'bar' },
					{
						properties: {
							foo: {
								description: 'foo',
								type: 'string',
								required: true,
							},
						},
					},
				),
			).to.not.throw(Error));

		it('should throw if object is invalid', () =>
			expect(() =>
				utils.validateObject(
					{ foo: 'bar' },
					{
						properties: {
							foo: {
								description: 'foo',
								type: 'number',
								required: true,
								message: 'Foo should be a number',
							},
						},
					},
				),
			).to.throw('Foo should be a number'));

		return it('should throw the first error if object has multiple validation issues', () =>
			expect(() =>
				utils.validateObject(
					{ foo: 'bar' },
					{
						properties: {
							foo: {
								description: 'foo',
								type: 'number',
								required: true,
								message: 'Foo should be a number',
							},
							bar: {
								description: 'bar',
								type: 'string',
								required: true,
								message: 'Bar should be a string',
							},
						},
					},
				),
			).to.throw('Foo should be a number'));
	});

	describe('fileExists()', function () {
		const filesystem = {
			'package.json': 'package.json contents',
			Dockerfile: 'Dockerfile contents',
		};

		beforeEach(() => mockFs(filesystem));

		afterEach(() => mockFs.restore());

		it('should return true if file exists', () =>
			expect(utils.fileExists('package.json')).to.be.true);

		return it('should return false if file does not exist', () =>
			expect(utils.fileExists('test.json')).to.be.false);
	});

	return describe('validateEnvVar()', function () {
		const validEnvVars = [
			'DEBUG=*',
			'PATH=/bin:/usr/bin',
			'XPC_FLAGS=0x0',
			'_=/usr/bin/env',
			'LC_ALL=en_US.UTF-8',
		];
		const invalidEnvVars = ['0TEST=1', '=1', '=='];

		it('should return empty array when called with no arguments', () =>
			expect(utils.validateEnvVar()).to.empty);

		it('should validate simple env var', () =>
			expect(utils.validateEnvVar(validEnvVars[0])).to.deep.equal([
				validEnvVars[0],
			]));

		it('should validate a list of env vars', () =>
			expect(utils.validateEnvVar(validEnvVars)).to.deep.equal(validEnvVars));

		it('should throw on invalid env var', () =>
			Array.from(invalidEnvVars).map((v) =>
				expect(() => utils.validateEnvVar(v)).to.throw(
					`Invalid environment variable: ${v}`,
				),
			));

		return it('should throw on invalid env var in list of env vars', () =>
			expect(() =>
				utils.validateEnvVar([...validEnvVars, ...invalidEnvVars]),
			).to.throw(`Invalid environment variable: ${invalidEnvVars[0]}`));
	});
});
