declare module 'resin-cli-form' {
	import * as Bluebird from 'bluebird';

	interface FormBase {
		message: string;
		name?: string;
		default?: any;
		when?: {
			[question: string]: string;
		};
	}

	interface FormText extends FormBase {
		type: 'text';
	}

	interface FormList extends FormBase {
		type: 'list';
		choices: string[] | Array<{ name: string; value: any }>;
	}

	interface FormInput extends FormBase {
		type: 'input';
		validate?: (value: string) => boolean;
	}

	interface FormDrive extends FormBase {
		type: 'drive';
	}

	interface FormPassword extends FormBase {
		type: 'password';
	}

	export function run(
		form: Array<FormText | FormList | FormInput | FormDrive | FormPassword>,
		options?: {
			override?: { [question: string]: string };
		},
	): Bluebird<{
		[question: string]: string;
	}>;

	export function ask<T = any>(
		form: FormText | FormList | FormInput | FormDrive | FormPassword,
	): Bluebird<T>;
}
