# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

# 6.0.1

* Export 'discover' utils

# 6.0.0

* Chore: code refactor
* rdt: push: support enviornment variable setting

# 5.3.3

* rdt: push: improve log streaming

# 5.3.2

* rdt: push: improve build log output
* rdt: fix container create/start configuration
* rdt: rename ResinOS -> resinOS
* rdt: use 'SpinnerPromise' from resin-cli-visuals module
* rdt: refactor: improve avahi service enumeration method

# 5.3.1

* rdt: create containers with 'host' network configuration

# 5.3.0

* rdt: use "rdt" CLI name in help and other messages
* rdt: validate app name
* rdt: add log streaming option flag and info message when enabled

# 5.2.1

* rdt: fix log streaming after sync

# 5.2.0

* rdt: remove connman bind mount
* rdt: implement inspectImage()
* rdt: preserve docker cache by removing previous image after build
* rdt: rename --force to --force-build
* rdt: support rsync update for local ResinOS AUFS devices
* rdt: stream stdout/stderr after rtd push

# 5.1.1

* rdt: Fix previous container removal during push

# 5.1.0

* rdt: Support avahi autodiscovery and export device select form for use from
  other modules
* rdt: Remove /etc/resolv.conf from bind mount list

# 5.0.0

* rdt: Save 'local-resinos' field in .resin-sync.yml
* rdt: Run containers with options similar to Resin.io devices
* rdt: Sync a folder between the dev machine and a running container on a remote device
* rdt: Do docker builds on remote device

# 4.1.0

* Add resin-toolbox sync structure
* Major refactorins to share as much functionality as possible between sync
  frontends

# 4.0.0

* [Breaking] - changed external API - `.capitano()` and `.sync()` are now
  the exported methods of the resin sync module. `resin-cli` capitano command
  is also integrated in the module.

# v3.1.7

* Unpublished resin-sync@3.1.6 from npm due to error during publishing module and republished as v3.1.7

# v3.1.6

## Changes

* Convert older, compatible versions of resin-sync.yml to .resin-sync.yml if the latter is not found in the project directory

# v3.1.5

## Changes

* Permit resin sync to device owners only and fail with descriptive message otherwise

# v3.1.4

## Fixes

* Install missing resin-cli-form dependency
* Lock node-rsync version to 0.4.0
* Fix space escape bug in .gitignore
* Add more thorough special character escaping tests

# v3.1.3

## Changes

* Pick (instead of omitting) sync options that will be saved in .resin-syc.yml

# v3.1.2

## Fixes

* Save full uuids in `.resin-sync.yml` to avoid conflicts when selecting
  default device in interactive choose dialog

# v3.1.1

## Fixes

* Fix order of app container start status messages

# v3.1.0

## New features

* Add '--after' option to run commands on local machine after resin sync

# v3.0.1

* Fix interactive destination choose dialog

# v3.0.0

## New features
  * **Parse .gitignore** for file inclusions/exclusions from resin sync by default (don't parse with `--skip-gitignore`)
  * **Automatically save options** to `${source}/.resin-sync.yml` after every run
  * Support **user-specified destination directories** with `--destination/-d` option

## Changes
  * `resin sync` **`--source/-s`** option is mandatory if a `.resin-sync.yml` file is not found in the current directory
  * `resin sync` now only accepts `uuid` as a destination (`appName` has been deprecated)

## Improvements
  * Major code refactoring - improved readability/maintainability
  * Improve error reporting

## Fixes
  * Disable ControlMaster ssh option (as reported in support)

# v2.2.0

* Code refactor, clean up unsused variables
* Support verbose flag for rsync and its ssh remote shell command

# v2.1.1

* HostOS version check before attempting rsync

# v2.1.0

* Support windows

# v2.0.0

* Support 'rsync' using the ssh gateway
