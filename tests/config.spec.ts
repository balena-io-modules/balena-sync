import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import * as mockFs from 'mock-fs';
import * as config from '../lib/yaml-config';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Config:', function () {
	describe('.getPath(baseDir)', function () {
		it('should be an absolute path', function () {
			const configPath = config.getPath('/tmp');
			return expect(path.isAbsolute(configPath)).to.be.true;
		});

		return it('should point to a yaml file', function () {
			const configPath = config.getPath('/tmp');
			return expect(path.extname(configPath)).to.equal('.yml');
		});
	});

	return describe('.load(baseDir)', function () {
		describe('given the file contains valid yaml', () =>
			it('should return the parsed contents', function () {
				const filesystem = {
					[config.getPath('/tmp')]: `\
source: 'src/'
before: 'echo Hello'\
`,
				};
				mockFs(filesystem);

				const options = config.load('/tmp');
				expect(options).to.deep.equal({
					source: 'src/',
					before: 'echo Hello',
				});

				return mockFs.restore();
			}));

		describe('given the file contains invalid yaml', () =>
			it('should return the parsed contents', function () {
				const filesystem = {
					[config.getPath('/tmp')]: `\
1234\
`,
				};
				mockFs(filesystem);

				expect(() => config.load('/tmp')).to.throw(
					`Invalid configuration file: ${config.getPath('/tmp')}`,
				);

				return mockFs.restore();
			}));

		return describe('given the file does not exist', () =>
			it('should return an empty object', function () {
				mockFs({});

				const options = config.load('/tmp');
				expect(options).to.deep.equal({});

				return mockFs.restore();
			}));
	});
});
