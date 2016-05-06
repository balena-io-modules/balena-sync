resin-sync
==========

> Watch a local project directory and sync it on the fly

[![npm version](https://badge.fury.io/js/resin-sync.svg)](http://badge.fury.io/js/resin-sync)
[![dependencies](https://david-dm.org/resin-io-modules/resin-sync.svg)](https://david-dm.org/resin-io-modules/resin-sync.svg)
[![Build Status](https://travis-ci.org/resin-io-modules/resin-sync.svg?branch=master)](https://travis-ci.org/resin-io-modules/resin-sync)
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/resin-io-modules/chat)

Role
----

The intention of this module is to provide a low level mechanism to sync code to devices.

**THIS MODULE IS LOW LEVEL AND IS NOT MEANT TO BE USED BY END USERS DIRECTLY**.

Installation
------------

Install `resin-sync` by running:

```sh
$ npm install --save resin-sync
```

Documentation
-------------

<a name="module_resinSync.sync"></a>

### resinSync.sync(uuid, [options])
This module provides a way to sync changes from a local source
directory to a device. It relies on the following dependencies
being installed in the system:

- `rsync`
- `ssh`

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

Windows
-------

1. Install [MinGW](http://www.mingw.org).
2. Install the `msys-rsync` and `msys-openssh` packages.
3. Add MinGW to the `%PATH%` if this hasn't been done by the installer already. The location where the binaries are places is usually `C:\MinGW\msys\1.0\bin`, but it can vary if you selected a different location in the installer.
4. Copy your SSH keys to `%homedrive%%homepath\.ssh`.

Support
-------

If you're having any problem, please [raise an issue](https://github.com/resin-io-modules/resin-sync/issues/new) on GitHub and the Resin.io team will be happy to help.

Tests
-----

Run the test suite by doing:

```sh
$ gulp test
```

Contribute
----------

- Issue Tracker: [github.com/resin-io-modules/resin-sync/issues](https://github.com/resin-io-modules/resin-sync/issues)
- Source Code: [github.com/resin-io-modules/resin-sync](https://github.com/resin-io-modules/resin-sync)

Before submitting a PR, please make sure that you include tests, and that [coffeelint](http://www.coffeelint.org/) runs without any warning:

```sh
$ gulp lint
```

License
-------

The project is licensed under the Apache 2.0 license.
