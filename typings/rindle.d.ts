declare module 'rindle' {
	import * as Bluebird from 'bluebird';

	export function wait(
		stream: any,
		callback?: (error: any) => void,
	): Bluebird<any>;
}
