m = require('mochainon')
path = require('path')
_ = require('lodash')
mockFs = require('mock-fs')
{ getFileHash, createBuildTriggerHashes, checkTriggers } = require('../lib/build-trigger')

filesystem =
	'package.json': 'package.json contents'
	'Dockerfile': 'Dockerfile contents'

savedBuildTriggers = [
	{ 'package.json': 'e2c193459707068888808a4e89c745162ed4e24bc093ac72f0009f5f15992cbb' }
	{ 'Dockerfile': 'f6aca399ab7883e1ebdf61b6d22756df83626409f824c0f6d80c2148478769b2' }
]

describe 'build-trigger', ->
	beforeEach ->
		mockFs(filesystem)

	afterEach ->
		mockFs.restore()

	describe 'getFileHash()', ->
		it 'should resolve with the correct hash', ->
			m.chai.expect(
				getFileHash('package.json')
		).to.eventually.equal(savedBuildTriggers[0]['package.json'])

	describe 'createBuildTriggerHashes()', ->
		it 'should return file hashes', ->
			createBuildTriggerHashes(files: _.keys(filesystem)).then (hashes) ->
				m.chai.expect(hashes).to.deep.equal(savedBuildTriggers)

		it "should return a single hash entry for 'Dockerfile', './Dockerfile' and '/full/path/Dockerfile'", ->
			files = _.keys(filesystem)
			files.push('./Dockerfile')
			files.push(path.join(process.cwd(), 'Dockerfile'))

			createBuildTriggerHashes({ files }).then (hashes) ->
				m.chai.expect(hashes).to.deep.equal(savedBuildTriggers)

		it 'should return file hashes if a file is missing and skipMissing is set to true (default)', ->
			files = _.keys(filesystem)
			files.push('test.json')

			createBuildTriggerHashes({ files }).then (hashes) ->
				m.chai.expect(hashes).to.deep.equal(savedBuildTriggers)

		it 'should throw if file is missing and skipMissing is set to false', ->
			files = _.keys(filesystem)
			files.push('test.json')

			m.chai.expect(
				createBuildTriggerHashes({ files, skipMissing: false })
			).to.be.rejectedWith('Could not calculate hash - File does not exist')

	describe 'checkTriggers()', ->
		it 'should resolve with true if a file is missing', ->
			mockFs(_.omit(filesystem, 'Dockerfile'))

			m.chai.expect(
				checkTriggers(savedBuildTriggers)
			).to.eventually.equal(true)

		it 'should resolve with true if a file has changed', ->
			mockFs(_.assign({}, filesystem, 'package.json': 'edited file'))

			m.chai.expect(
				checkTriggers(savedBuildTriggers)
			).to.eventually.equal(true)

		it 'should resolve with false if no file has changed', ->
			m.chai.expect(
				checkTriggers(savedBuildTriggers)
			).to.eventually.equal(false)
