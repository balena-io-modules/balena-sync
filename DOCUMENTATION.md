## Modules

<dl>
<dt><a href="#module_resinSync">resinSync</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#load">load()</a> ⇒ <code>Object</code></dt>
<dd><p>If no configuration file is found, return an empty object.</p>
</dd>
<dt><a href="#getCommand">getCommand(options)</a> ⇒ <code>String</code></dt>
<dd></dd>
<dt><a href="#getSubShellCommand">getSubShellCommand(command)</a> ⇒ <code>String</code></dt>
<dd></dd>
<dt><a href="#runCommand">runCommand(command)</a> ⇒ <code>Promise</code></dt>
<dd><p>stdin is inherited from the parent process.</p>
</dd>
<dt><a href="#getConnectCommand">getConnectCommand([options])</a> ⇒ <code>String</code></dt>
<dd></dd>
<dt><a href="#validateObject">validateObject(object, rules)</a></dt>
<dd></dd>
</dl>

<a name="module_resinSync"></a>

## resinSync
<a name="module_resinSync.sync"></a>

### resinSync.sync(uuid, [options])
This module provides a way to sync changes from a local source
directory to a device. It relies on the following dependencies
being installed in the system:

- `rsync`
- `ssh`

Resin Sync **doesn't support Windows yet**, however it will work
under Cygwin.

You can save all the options mentioned below in a `resin-sync.yml`
file, by using the same option names as keys. For example:

	$ cat $PWD/resin-sync.yml
	source: src/
	before: 'echo Hello'
	ignore:
		- .git
		- node_modules/
	progress: true

Notice that explicitly passed command options override the ones
set in the configuration file.

**Kind**: static method of <code>[resinSync](#module_resinSync)</code>  
**Summary**: Sync your changes with a device  
**Access:** public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| uuid | <code>String</code> |  | device uuid |
| [options] | <code>Object</code> |  | options |
| [options.source] | <code>String</code> | <code>$PWD</code> | source path |
| [options.ignore] | <code>Array.&lt;String&gt;</code> |  | ignore paths |
| [options.before] | <code>String</code> |  | command to execute before sync |
| [options.progress] | <code>Boolean</code> | <code>true</code> | display sync progress |
| [options.port] | <code>Number</code> | <code>22</code> | ssh port |

**Example**  
```js
resinSync.sync('7a4e3dc', {
  ignore: [ '.git', 'node_modules' ],
  progress: false
});
```
<a name="load"></a>

## load() ⇒ <code>Object</code>
If no configuration file is found, return an empty object.

**Kind**: global function  
**Summary**: Load configuration file  
**Returns**: <code>Object</code> - configuration  
**Access:** protected  
**Example**  
```js
options = config.load()
```
<a name="getCommand"></a>

## getCommand(options) ⇒ <code>String</code>
**Kind**: global function  
**Summary**: Get rsync command  
**Returns**: <code>String</code> - rsync command  
**Access:** protected  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | rsync options |
| options.username | <code>String</code> |  | username |
| options.uuid | <code>String</code> |  | device uuid |
| options.containerId | <code>String</code> |  | container id |
| options.source | <code>String</code> |  | source path |
| [options.progress] | <code>Boolean</code> |  | show progress |
| [options.ignore] | <code>String</code> &#124; <code>Array.&lt;String&gt;</code> |  | pattern/s to ignore |
| [options.port] | <code>Number</code> | <code>22</code> | ssh port |

**Example**  
```js
command = rsync.getCommand
		username: 'test',
		uuid: '1324'
		containerId: '6789',
	source: 'foo/bar'
```
<a name="getSubShellCommand"></a>

## getSubShellCommand(command) ⇒ <code>String</code>
**Kind**: global function  
**Summary**: Get sub shell command  
**Returns**: <code>String</code> - sub shell command  
**Access:** protected  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | command |

**Example**  
```js
subShellCommand = shell.getSubShellCommand('foo')
```
<a name="runCommand"></a>

## runCommand(command) ⇒ <code>Promise</code>
stdin is inherited from the parent process.

**Kind**: global function  
**Summary**: Run a command in a subshell  
**Access:** protected  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | command |

**Example**  
```js
shell.runCommand('echo hello').then ->
	console.log('Done!')
```
<a name="getConnectCommand"></a>

## getConnectCommand([options]) ⇒ <code>String</code>
**Kind**: global function  
**Summary**: Get SSH connection command for a device  
**Returns**: <code>String</code> - ssh command  
**Access:** protected  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | options |
| [options.username] | <code>String</code> | username |
| [options.uuid] | <code>String</code> | device uuid |
| [options.containerId] | <code>String</code> | container id |
| [options.port] | <code>Number</code> | resin ssh gateway port |

**Example**  
```js
ssh.getConnectCommand
		username: 'test'
	uuid: '1234'
	containerId: '4567'
	command: 'date'
```
<a name="validateObject"></a>

## validateObject(object, rules)
**Kind**: global function  
**Summary**: Validate object  
**Throws**:

- Will throw if object is invalid

**Access:** protected  

| Param | Type | Description |
| --- | --- | --- |
| object | <code>Object</code> | input object |
| rules | <code>Object</code> | validation rules |

**Example**  
```js
utils.validateObject
	foo: 'bar'
,
	properties:
		foo:
			description: 'foo'
			type: 'string'
			required: true
```
