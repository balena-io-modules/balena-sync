import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import Docker = require('docker-toolbelt');
import * as form from 'resin-cli-form';
import { discoverLocalBalenaOsDevices } from './discover';
import { SpinnerPromise } from 'resin-cli-visuals';
import { dockerPort, dockerTimeout } from './config';

type Awaited<T extends Promise<any>> = T extends Promise<infer U> ? U : never;

// Select a sync destination folder
export const selectSyncDestination = (preferredDestination: string) =>
	form
		.run(
			[
				{
					message: 'Destination directory on device container [/usr/src/app]',
					name: 'destination',
					type: 'input',
				},
			],
			{
				override: {
					destination: preferredDestination,
				},
			},
		)
		.get('destination')
		.then((destination) =>
			destination != null ? destination : '/usr/src/app',
		);

export const selectLocalBalenaOsDevice = function (timeout: number = 4000) {
	return (
		new SpinnerPromise({
			promise: discoverLocalBalenaOsDevices(timeout),
			startMessage: 'Discovering local balenaOS devices..',
			stopMessage: 'Reporting discovered devices',
		}) as Bluebird<Awaited<ReturnType<typeof discoverLocalBalenaOsDevices>>>
	)
		.filter(function (
			param: { address?: string; host?: string; port?: number } = {},
		) {
			const { address } = param;
			if (!address) {
				return false;
			}

			return Bluebird.try(function () {
				const docker = new Docker({
					host: address,
					port: dockerPort,
					timeout: dockerTimeout,
				});
				return docker.ping();
			})
				.return(true)
				.catchReturn(false);
		})
		.then(function (devices) {
			if (_.isEmpty(devices)) {
				throw new Error('Could not find any local balenaOS devices');
			}

			return form.ask({
				message: 'select a device',
				type: 'list',
				default: (devices[0] as any).ip,
				choices: _.map(devices, (device) => ({
					name: `${device.host || 'untitled'} (${device.address})`,
					value: device.address,
				})),
			});
		});
};
