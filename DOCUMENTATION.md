## Modules

<dl>
<dt><a href="#module_build-trigger">build-trigger</a></dt>
<dd><p>Helper methods for build-trigger <code>balena local push</code> feature</p>
</dd>
<dt><a href="#module_balenaSync">balenaSync</a></dt>
<dd></dd>
<dt><a href="#module_build-trigger">build-trigger</a></dt>
<dd><p>Helper methods to manipulate the balena push/sync configuration file (currently .balena-sync.yml)</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#build">build(options)</a> ⇒</dt>
<dd></dd>
<dt><a href="#createContainer">createContainer(name, [options])</a> ⇒</dt>
<dd></dd>
<dt><a href="#buildRsyncCommand">buildRsyncCommand(options)</a> ⇒ <code>String</code></dt>
<dd></dd>
<dt><a href="#getSubShellCommand">getSubShellCommand(command)</a> ⇒ <code>String</code></dt>
<dd></dd>
<dt><a href="#runCommand">runCommand(command, cwd)</a> ⇒ <code>Promise</code></dt>
<dd><p>stdin is inherited from the parent process.</p>
</dd>
<dt><a href="#sync">sync(options)</a> ⇒</dt>
<dd></dd>
<dt><a href="#validateObject">validateObject(object, rules)</a></dt>
<dd></dd>
<dt><a href="#gitignoreToRsyncPatterns">gitignoreToRsyncPatterns(gitignoreFile)</a> ⇒</dt>
<dd><p>Note that in rsync &#39;include&#39;&#39;s must be set before &#39;exclude&#39;&#39;s</p>
</dd>
<dt><a href="#fileExists">fileExists(filename)</a> ⇒ <code>Boolean</code></dt>
<dd></dd>
<dt><a href="#validateEnvVar">validateEnvVar([env])</a> ⇒ <code>Array</code></dt>
<dd></dd>
</dl>

<a name="module_build-trigger"></a>

## build-trigger
Helper methods for build-trigger `balena local push` feature


* [build-trigger](#module_build-trigger)
    * _static_
        * [.createBuildTriggerHashes(options)](#module_build-trigger.createBuildTriggerHashes) ⇒ <code>Promise</code>
        * [.load([baseDir], [configFile])](#module_build-trigger.load) ⇒ <code>Object</code>
        * [.save(yamlObj, [baseDir], [configFile])](#module_build-trigger.save)
    * _inner_
        * [~getFileHash(file, [algo])](#module_build-trigger..getFileHash) ⇒ <code>Promise</code>
        * [~checkTriggers(buildTriggers, [baseDir])](#module_build-trigger..checkTriggers) ⇒ <code>Promise</code>

<a name="module_build-trigger.createBuildTriggerHashes"></a>

### build-trigger.createBuildTriggerHashes(options) ⇒ <code>Promise</code>
**Kind**: static method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Creates an array of objects with the hashes of the passed files  
**Throws**:

- Exception on error or if 'skipMissing' is false and a file in the 'files' array does not exis


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | options |
| [options.files] | <code>Array.&lt;String&gt;</code> | <code>[]</code> | array of file paths to calculate hashes |
| [options.baseDir] | <code>String</code> | <code>process.cwd()</code> | Base directory for relative file paths |
| [options.skipMissing] | <code>Boolean</code> | <code>true</code> | Skip non-existent files from the 'files' array |

**Example**  
```js
createBuildTriggerHashes({ files: [ 'package.json', 'Dockerfile' ] }).then (hashes) ->
// resolves with 'hashes' array:
[
		{ 'package.json': <sha256> }
		{ 'Dockerfile': <sha256> }
	]
```
<a name="module_build-trigger.load"></a>

### build-trigger.load([baseDir], [configFile]) ⇒ <code>Object</code>
If no configuration file is found, return an empty object.

**Kind**: static method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Load configuration file  
**Returns**: <code>Object</code> - YAML configuration as object  
**Throws**:

- Exception on error

**Access**: protected  

| Param | Type | Default |
| --- | --- | --- |
| [baseDir] | <code>String</code> | <code>process.cwd()</code> | 
| [configFile] | <code>String</code> | <code>CONFIG_FILE</code> | 

**Example**  
```js
options = config.load('.')
```
<a name="module_build-trigger.save"></a>

### build-trigger.save(yamlObj, [baseDir], [configFile])
**Kind**: static method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Serializes object as yaml object and saves it to file  
**Throws**:

- Exception on error

**Access**: protected  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| yamlObj | <code>String</code> |  | YAML object to save |
| [baseDir] | <code>String</code> | <code>process.cwd()</code> |  |
| [configFile] | <code>String</code> | <code>CONFIG_FILE</code> |  |

**Example**  
```js
config.save(yamlObj)
```
<a name="module_build-trigger..getFileHash"></a>

### build-trigger~getFileHash(file, [algo]) ⇒ <code>Promise</code>
**Kind**: inner method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Return file hash - based on https://nodejs.org/api/crypto.html  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| file | <code>String</code> |  | file path |
| [algo] | <code>String</code> | <code>&#x27;sha256&#x27;</code> | Hash algorithm |

**Example**  
```js
getFileHash('package.json').then (hash) ->
		console.log('hash')
```
<a name="module_build-trigger..checkTriggers"></a>

### build-trigger~checkTriggers(buildTriggers, [baseDir]) ⇒ <code>Promise</code>
**Kind**: inner method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Checks if any of the files in the build trigger list has changed or is missing  
**Returns**: <code>Promise</code> - - Resolves with true if any file hash has changed or any of the files was missing,
false otherwise  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| buildTriggers | <code>Object</code> |  | Array of { filePath: hash } objects |
| [baseDir] | <code>String</code> | <code>process.cwd()</code> | Base directory for relative file paths in 'buildTriggers' |

**Example**  
```js
checkTriggers('package.json': 1234, 'Dockerfile': 5678).then (triggered) ->
		console.log(triggered)
```
<a name="module_balenaSync"></a>

## balenaSync
<a name="module_balenaSync.sync"></a>

### balenaSync.sync([syncOptions])
This module provides a way to sync changes from a local source
directory to a device. It relies on the following dependencies
being installed in the system:

- `rsync`
- `ssh`

You can save all the options mentioned below in a `balena-sync.yml`
file, by using the same option names as keys. For example:

	$ cat $PWD/balena-sync.yml
	destination: '/usr/src/app/'
	before: 'echo Hello'
	after: 'echo Done'
	port: 22
	ignore:
		- .git
		- node_modules/

Notice that explicitly passed command options override the ones
set in the configuration file.

**Kind**: static method of [<code>balenaSync</code>](#module_balenaSync)  
**Summary**: Sync your changes with a device  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [syncOptions] | <code>Object</code> |  | cli options |
| [syncOptions.uuid] | <code>String</code> |  | device uuid |
| [syncOptions.baseDir] | <code>String</code> |  | project base dir |
| [syncOptions.destination] | <code>String</code> | <code>/usr/src/app</code> | destination directory on device |
| [syncOptions.before] | <code>String</code> |  | command to execute before sync |
| [syncOptions.after] | <code>String</code> |  | command to execute after sync |
| [syncOptions.ignore] | <code>Array.&lt;String&gt;</code> |  | ignore paths |
| [syncOptions.port] | <code>Number</code> | <code>22</code> | ssh port |
| [syncOptions.skipGitignore] | <code>Boolean</code> | <code>false</code> | skip .gitignore when parsing exclude/include files |
| [syncOptions.skipRestart] | <code>Boolean</code> | <code>false</code> | do not restart container after sync |
| [syncOptions.progress] | <code>Boolean</code> | <code>false</code> | display rsync progress |
| [syncOptions.verbose] | <code>Boolean</code> | <code>false</code> | display verbose info |

**Example**  
```js
sync({
		uuid: '7a4e3dc',
		baseDir: '.',
		destination: '/usr/src/app',
  ignore: [ '.git', 'node_modules' ],
  progress: false
});
```
<a name="module_build-trigger"></a>

## build-trigger
Helper methods to manipulate the balena push/sync configuration file (currently .balena-sync.yml)


* [build-trigger](#module_build-trigger)
    * _static_
        * [.createBuildTriggerHashes(options)](#module_build-trigger.createBuildTriggerHashes) ⇒ <code>Promise</code>
        * [.load([baseDir], [configFile])](#module_build-trigger.load) ⇒ <code>Object</code>
        * [.save(yamlObj, [baseDir], [configFile])](#module_build-trigger.save)
    * _inner_
        * [~getFileHash(file, [algo])](#module_build-trigger..getFileHash) ⇒ <code>Promise</code>
        * [~checkTriggers(buildTriggers, [baseDir])](#module_build-trigger..checkTriggers) ⇒ <code>Promise</code>

<a name="module_build-trigger.createBuildTriggerHashes"></a>

### build-trigger.createBuildTriggerHashes(options) ⇒ <code>Promise</code>
**Kind**: static method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Creates an array of objects with the hashes of the passed files  
**Throws**:

- Exception on error or if 'skipMissing' is false and a file in the 'files' array does not exis


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | options |
| [options.files] | <code>Array.&lt;String&gt;</code> | <code>[]</code> | array of file paths to calculate hashes |
| [options.baseDir] | <code>String</code> | <code>process.cwd()</code> | Base directory for relative file paths |
| [options.skipMissing] | <code>Boolean</code> | <code>true</code> | Skip non-existent files from the 'files' array |

**Example**  
```js
createBuildTriggerHashes({ files: [ 'package.json', 'Dockerfile' ] }).then (hashes) ->
// resolves with 'hashes' array:
[
		{ 'package.json': <sha256> }
		{ 'Dockerfile': <sha256> }
	]
```
<a name="module_build-trigger.load"></a>

### build-trigger.load([baseDir], [configFile]) ⇒ <code>Object</code>
If no configuration file is found, return an empty object.

**Kind**: static method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Load configuration file  
**Returns**: <code>Object</code> - YAML configuration as object  
**Throws**:

- Exception on error

**Access**: protected  

| Param | Type | Default |
| --- | --- | --- |
| [baseDir] | <code>String</code> | <code>process.cwd()</code> | 
| [configFile] | <code>String</code> | <code>CONFIG_FILE</code> | 

**Example**  
```js
options = config.load('.')
```
<a name="module_build-trigger.save"></a>

### build-trigger.save(yamlObj, [baseDir], [configFile])
**Kind**: static method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Serializes object as yaml object and saves it to file  
**Throws**:

- Exception on error

**Access**: protected  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| yamlObj | <code>String</code> |  | YAML object to save |
| [baseDir] | <code>String</code> | <code>process.cwd()</code> |  |
| [configFile] | <code>String</code> | <code>CONFIG_FILE</code> |  |

**Example**  
```js
config.save(yamlObj)
```
<a name="module_build-trigger..getFileHash"></a>

### build-trigger~getFileHash(file, [algo]) ⇒ <code>Promise</code>
**Kind**: inner method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Return file hash - based on https://nodejs.org/api/crypto.html  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| file | <code>String</code> |  | file path |
| [algo] | <code>String</code> | <code>&#x27;sha256&#x27;</code> | Hash algorithm |

**Example**  
```js
getFileHash('package.json').then (hash) ->
		console.log('hash')
```
<a name="module_build-trigger..checkTriggers"></a>

### build-trigger~checkTriggers(buildTriggers, [baseDir]) ⇒ <code>Promise</code>
**Kind**: inner method of [<code>build-trigger</code>](#module_build-trigger)  
**Summary**: Checks if any of the files in the build trigger list has changed or is missing  
**Returns**: <code>Promise</code> - - Resolves with true if any file hash has changed or any of the files was missing,
false otherwise  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| buildTriggers | <code>Object</code> |  | Array of { filePath: hash } objects |
| [baseDir] | <code>String</code> | <code>process.cwd()</code> | Base directory for relative file paths in 'buildTriggers' |

**Example**  
```js
checkTriggers('package.json': 1234, 'Dockerfile': 5678).then (triggered) ->
		console.log(triggered)
```
<a name="build"></a>

## build(options) ⇒
**Kind**: global function  
**Summary**: Start image-building 'balena local push' process  
**Returns**: - Exits process with 0 on success or 1 otherwise  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | options |
| options.appName | <code>String</code> |  | Application image (i.e. image & container name) |
| options.deviceIp | <code>String</code> |  | Device ip or host |
| [options.baseDir] | <code>String</code> | <code>process.cwd()</code> | Project base directory that also containers Dockerfile |

**Example**  
```js
build(appName: 'test', deviceIp: '192.168.1.1')
```
<a name="createContainer"></a>

## createContainer(name, [options]) ⇒
**Kind**: global function  
**Summary**: Create a container  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| name | <code>String</code> |  | Container name - and Image with the same name must already exist |
| [options] | <code>Object</code> |  | options |
| [options.env] | <code>Array</code> | <code>[]</code> | environment variables in the form [ 'ENV=value' ] |

<a name="buildRsyncCommand"></a>

## buildRsyncCommand(options) ⇒ <code>String</code>
**Kind**: global function  
**Summary**: Build rsync command  
**Returns**: <code>String</code> - rsync command  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | rsync options |
| options.username | <code>String</code> | username |
| options.host | <code>String</code> | host |
| [options.progress] | <code>Boolean</code> | show progress |
| [options.ignore] | <code>String</code> \| <code>Array.&lt;String&gt;</code> | pattern/s to ignore. Note that '.gitignore' is always used as a filter if it exists |
| [options.skipGitignore] | <code>Boolean</code> | skip gitignore |
| [options.verbose] | <code>Boolean</code> | verbose output |
| options.source | <code>String</code> | source directory on local machine |
| options.destination | <code>String</code> | destination directory on device |
| options.rsyncPath | <code>String</code> | set --rsync-path rsync option |

**Example**  
```js
command = rsync.buildRsyncCommand
		host: 'ssh.balena-devices.com'
		username: 'test'
		source: '/home/user/app',
		destination: '/usr/src/app'
```
<a name="getSubShellCommand"></a>

## getSubShellCommand(command) ⇒ <code>String</code>
**Kind**: global function  
**Summary**: Get sub shell command  
**Returns**: <code>String</code> - sub shell command  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | command |

**Example**  
```js
subShellCommand = shell.getSubShellCommand('foo')
```
<a name="runCommand"></a>

## runCommand(command, cwd) ⇒ <code>Promise</code>
stdin is inherited from the parent process.

**Kind**: global function  
**Summary**: Run a command in a subshell  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| command | <code>String</code> | command |
| cwd | <code>String</code> | current working directory |

**Example**  
```js
shell.runCommand('echo hello').then ->
	console.log('Done!')
```
<a name="sync"></a>

## sync(options) ⇒
**Kind**: global function  
**Summary**: Run rsync on a local balenaOS device  
**Throws**:

- Exception on error


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| options | <code>Object</code> |  | options |
| options.deviceIp | <code>String</code> |  | Destination device ip/host |
| options.baseDir | <code>String</code> |  | Project base dir |
| options.appName | <code>String</code> |  | Application container name |
| options.destination | <code>String</code> |  | Sync destination folder in container |
| [options.before] | <code>String</code> |  | Action to execute locally before sync |
| [options.after] | <code>String</code> |  | Action to execute locally after sync |
| [options.progress] | <code>String</code> | <code>false</code> | Show progress |
| [options.verbose] | <code>String</code> | <code>false</code> | Show progress |
| [options.skipGitignore] | <code>String</code> | <code>false</code> | Skip .gitignore parsing |
| [options.ignore] | <code>String</code> |  | rsync ignore list |

**Example**  
```js
sync()
```
<a name="validateObject"></a>

## validateObject(object, rules)
**Kind**: global function  
**Summary**: Validate object  
**Throws**:

- Will throw if object is invalid

**Access**: protected  

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
<a name="gitignoreToRsyncPatterns"></a>

## gitignoreToRsyncPatterns(gitignoreFile) ⇒
Note that in rsync 'include''s must be set before 'exclude''s

**Kind**: global function  
**Summary**: Transform .gitignore patterns to rsync compatible exclude/include patterns  
**Returns**: object with include/exclude options  
**Throws**:

- an exception if there was an error accessing the file

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| gitignoreFile | <code>String</code> | .gitignore file location |

**Example**  
For .gitignore:
```
		node_modules/
		lib/*
		!lib/includeme.coffee
```

utils.gitignoreToRsync('.gitignore') returns

{
		include: [ 'lib/includeme.coffee' ]
		exclude: [ 'node_modules/', 'lib/*' ]
	}
<a name="fileExists"></a>

## fileExists(filename) ⇒ <code>Boolean</code>
**Kind**: global function  
**Summary**: Check if file exists  
**Throws**:

- Exception on error


| Param | Type | Description |
| --- | --- | --- |
| filename | <code>Object</code> | file path |

**Example**  
```js
dockerfileExists = fileExists('Dockerfile')
```
<a name="validateEnvVar"></a>

## validateEnvVar([env]) ⇒ <code>Array</code>
**Kind**: global function  
**Summary**: Validate 'ENV=value' environment variable(s)  
**Returns**: <code>Array</code> - - returns array of passed env var(s) if valid  
**Throws**:

- Exception if a variable name is not valid in accordance with
IEEE Std 1003.1-2008, 2016 Edition, Ch. 8, p. 1


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [env] | <code>String</code> \| <code>Array</code> | <code>[]</code> | 'ENV_NAME=value' string |

