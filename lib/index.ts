import type { CapitanoCommand } from './capitano';
import type { SyncTarget } from './sync';

export const capitano = (cliTool: CapitanoCommand) =>
	require('./capitano')(cliTool);
export const sync = (target: SyncTarget) => require('./sync')(target);

const lazy = (module: string) => ({
	enumerable: true,
	get() {
		return require(module);
	},
});

export const config = lazy('./yaml-config');
export const discover = lazy('./discover');
export const forms = lazy('./forms');
export const BalenaLocalDockerUtils = lazy('./docker-utils');
