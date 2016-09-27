resin-sync
==========

> Update your application from a local source directory to a device on-the-fly.

[![npm version](https://badge.fury.io/js/resin-sync.svg)](http://badge.fury.io/js/resin-sync)
[![dependencies](https://david-dm.org/resin-io-modules/resin-sync.svg)](https://david-dm.org/resin-io-modules/resin-sync.svg)
[![Build Status](https://travis-ci.org/resin-io-modules/resin-sync.svg?branch=master)](https://travis-ci.org/resin-io-modules/resin-sync)
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/resin-io-modules/chat)

Role
----

The intention of this module is to provide a way to sync changes from a local source directory to a device.

**THIS MODULE IS LOW LEVEL AND IS NOT MEANT TO BE USED BY END USERS DIRECTLY**.

Installation
------------

Install `resin-sync` by running:

```sh
$ npm install --save resin-sync
```

Dependencies
------------

`resin sync` relies on the following dependencies
being installed in the system:

- `rsync`
- `ssh`

#### For Windows users:

1. Install [MinGW](http://www.mingw.org).
2. Install the `msys-rsync` and `msys-openssh` packages.
3. Add MinGW to the `%PATH%` if this hasn't been done by the installer already. The location where the binaries are places is usually `C:\MinGW\msys\1.0\bin`, but it can vary if you selected a different location in the installer.
4. Copy your SSH keys to `%homedrive%%homepath\.ssh`.

API
-------------

This module exports two methods:

#### capitano(cliTool)

This returns [`capitano`](https://github.com/resin-io/capitano) command that
can be registered by a cli tool. It is a convenience method that allows
adding/modifying `resin sync` capitano commands/options without requiring changes in
both the cli tool and the `resin-sync` module. The list of supported cli
tools currently only includes 'resin-cli'

Example usage in `resin-cli`:

```coffeescript
resinCliSyncCmd = require('resin-sync').capitano('resin-cli')
capitano.command(resinCliSyncCmd)
```

#### sync(target)

This method returns the proper `sync()` method for the specified `target`.
Specifying different targets is necessary because the *application sync*
process needs to adapt to the particular destination environment.

The list of currently support targets is

* `remote-resin-io-device`
* `local-resin-os-device`

and more will be added incrementally (e.g. `remote-resin-os-device`,
`virtual-resin-os-device` etc.)

The `sync()` method can be used directly by modules that don't use capitano.

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
