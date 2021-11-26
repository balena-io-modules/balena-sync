module.exports = {
	reporter: 'spec',
	require: 'ts-node/register/transpile-only',
	timeout: 12000,
	spec: 'tests/**/*.spec.ts',
};
