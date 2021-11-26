export type SyncTarget = 'remote-balena-io-device' | 'local-balena-os-device';
const syncTargets: SyncTarget[] = [
	'remote-balena-io-device',
	'local-balena-os-device',
];

export default function (target: SyncTarget | null) {
	if (target == null || !syncTargets.includes(target)) {
		throw new Error(
			`Invalid balena-sync target '${target}'. Supported targets are: ${syncTargets}`,
		);
	}

	return require('./' + target);
}
