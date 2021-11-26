declare module 'revalidator' {
	export function validate(
		object: any,
		schema: any,
	): {
		valid: boolean;
		errors: Array<{ message: string }>;
	};
}
