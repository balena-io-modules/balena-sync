export type CapitanoCommand = 'balena-cli' | 'balena-toolbox';
const capitanoCommands: CapitanoCommand[] = ['balena-cli', 'balena-toolbox'];

export default function (command: CapitanoCommand | null) {
	if (command == null || !capitanoCommands.includes(command)) {
		throw new Error(
			`Invalid balena-sync capitano command '${command}'. Available commands are: ${capitanoCommands}`,
		);
	}

	return require('./' + command);
}
