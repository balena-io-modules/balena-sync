balena-sync
==========

> Update your application from a local source directory to a device on-the-fly.

[![npm version](https://badge.fury.io/js/balena-sync.svg)](http://badge.fury.io/js/balena-sync)
[![dependencies](https://david-dm.org/balena-io-modules/balena-sync.svg)](https://david-dm.org/balena-io-modules/balena-sync.svg)
[![Build Status](https://travis-ci.org/balena-io-modules/balena-sync.svg?branch=master)](https://travis-ci.org/balena-io-modules/balena-sync)
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/balena-io-modules/chat)

Role
----

The intention of this module is to provide a way to sync changes from a local source directory to a device.

**THIS MODULE IS LOW LEVEL AND IS NOT MEANT TO BE USED BY END USERS DIRECTLY**.

API
-------------

This module exports two methods:

#### capitano(cliTool)

This returns [`capitano`](https://github.com/balena-io/capitano) command that
can be registered by a cli tool. It is a convenience method that allows
adding/modifying `balena sync` capitano commands/options without requiring changes in
both the cli tool and the `balena-sync` module. The list of supported cli
tools currently only includes 'balena-cli'

Example usage in `balena-cli`:

```coffeescript
balenaCliSyncCmd = require('balena-sync').capitano('balena-cli')
capitano.command(balenaCliSyncCmd)
```

#### sync(target)

This method returns the proper `sync()` method for the specified `target`.
Specifying different targets is necessary because the *application sync*
process needs to adapt to the particular destination environment.

The list of currently support targets is

* `remote-balena-io-device`
* `local-balena-os-device`

and more will be added incrementally (e.g. `remote-balena-os-device`,
`virtual-balena-os-device` etc.)

The `sync()` method can be used directly by modules that don't use capitano.

Support
-------

If you're having any problem, please [raise an issue](https://github.com/balena-io-modules/balena-sync/issues/new) on GitHub and the balena team will be happy to help.

Tests
-----

Run the test suite by doing:

```sh
$ gulp test
```

Contribute
----------

- Issue Tracker: [github.com/balena-io-modules/balena-sync/issues](https://github.com/balena-io-modules/balena-sync/issues)
- Source Code: [github.com/balena-io-modules/balena-sync](https://github.com/balena-io-modules/balena-sync)

Before submitting a PR, please make sure that you include tests, and that [coffeelint](http://www.coffeelint.org/) runs without any warning:

```sh
$ gulp lint
```

License
-------

The project is licensed under the Apache 2.0 license.
