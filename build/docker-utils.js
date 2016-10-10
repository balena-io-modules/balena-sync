var Docker, JSONStream, Promise, _, defaultBinds, defaultVolumes, docker, ensureDockerInit, es, fs, getContainerStartOptions, path, readFileViaSSH, semver, ssh2, tar;

fs = require('fs');

path = require('path');

Docker = require('docker-toolbelt');

Promise = require('bluebird');

es = require('event-stream');

JSONStream = require('JSONStream');

tar = require('tar-fs');

ssh2 = require('ssh2');

Promise.promisifyAll(ssh2.Client);

semver = require('semver');

_ = require('lodash');

docker = null;

readFileViaSSH = Promise.method(function(host, port, file) {
  var getSSHConnection;
  getSSHConnection = function() {
    return new Promise(function(resolve, reject) {
      var client;
      client = new ssh2.Client();
      return client.on('ready', function() {
        return resolve(client);
      }).on('error', function(err) {
        var errMsg, errSource;
        errSource = (err != null ? err.level : void 0) ? 'client-socket' : 'client-ssh';
        errMsg = errSource + " error during SSH connection: " + (err != null ? err.description : void 0);
        return reject(new Error(errMsg));
      }).connect({
        username: 'root',
        agent: process.env.SSH_AUTH_SOCK,
        host: host,
        port: port,
        keepaliveCountMax: 3,
        keepaliveInterval: 10000,
        readyTimeout: 30000,
        tryKeyboard: false
      });
    }).disposer(function(client) {
      return client.end();
    });
  };
  return Promise.using(getSSHConnection(), function(client) {
    return client.execAsync("cat " + file).then(function(stream) {
      return new Promise(function(resolve, reject) {
        var bufStdout;
        bufStdout = [];
        return stream.on('data', function(chunk) {
          return bufStdout.push(chunk);
        }).on('close', function(code, signal) {
          var data;
          data = Buffer.concat(bufStdout).toString();
          return resolve({
            data: data,
            code: code,
            signal: signal
          });
        }).on('error', reject);
      }).tap(function(arg) {
        var code, data, signal;
        data = arg.data, code = arg.code, signal = arg.signal;
        if (code !== 0) {
          throw new Error("Could not read file from Docker Host. Code: " + code);
        }
      }).get('data');
    });
  });
});

Docker.prototype.containerRootDir = function(container, host, port) {
  if (port == null) {
    port = 22222;
  }
  return Promise.all([this.infoAsync(), this.versionAsync().get('Version'), this.getContainer(container).inspectAsync()]).spread(function(dockerInfo, dockerVersion, containerInfo) {
    var containerId, dkroot;
    dkroot = dockerInfo.DockerRootDir;
    containerId = containerInfo.Id;
    return Promise["try"](function() {
      var destFile, readFile;
      if (semver.lt(dockerVersion, '1.10.0')) {
        return containerId;
      }
      destFile = path.join(dkroot, "image/" + dockerInfo.Driver + "/layerdb/mounts", containerId, 'mount-id');
      if (host != null) {
        readFile = _.partial(readFileViaSSH, host, port);
      } else {
        readFile = fs.readFileAsync;
      }
      return readFile(destFile);
    }).then(function(destId) {
      switch (dockerInfo.Driver) {
        case 'btrfs':
          return path.join(dkroot, 'btrfs/subvolumes', destId);
        case 'overlay':
          return containerInfo.GraphDriver.Data.RootDir;
        case 'vfs':
          return path.join(dkroot, 'vfs/dir', destId);
        case 'aufs':
          return path.join(dkroot, 'aufs/mnt', destId);
        default:
          throw new Error("Unsupported driver: " + dockerInfo.Driver + "/");
      }
    });
  });
};

defaultVolumes = {
  '/data': {},
  '/lib/modules': {},
  '/lib/firmware': {},
  '/host/var/lib/connman': {},
  '/host/run/dbus': {}
};

defaultBinds = function(dataPath) {
  var data;
  data = path.join('/resin-data', dataPath) + ':/data';
  return [data, '/lib/modules:/lib/modules', '/lib/firmware:/lib/firmware', '/run/dbus:/host_run/dbus', '/run/dbus:/host/run/dbus'];
};

getContainerStartOptions = Promise.method(function(image) {
  var binds;
  if (!image) {
    throw new Error('Please give an image name or ID');
  }
  binds = defaultBinds(image);
  return {
    Privileged: true,
    NetworkMode: 'host',
    Binds: binds,
    RestartPolicy: {
      Name: 'always',
      MaximumRetryCount: 0
    }
  };
});

ensureDockerInit = function() {
  if (docker == null) {
    throw new Error('Docker client not initialized');
  }
};

module.exports = {
  dockerInit: function(dockerHostIp, dockerPort) {
    if (dockerHostIp == null) {
      dockerHostIp = '127.0.0.1';
    }
    if (dockerPort == null) {
      dockerPort = 2375;
    }
    if (docker == null) {
      docker = new Docker({
        host: dockerHostIp,
        port: dockerPort
      });
    }
    return docker;
  },
  checkForExistingImage: Promise.method(function(name) {
    ensureDockerInit();
    return docker.getImage(name).inspectAsync().then(function(imageInfo) {
      return true;
    })["catch"](function(err) {
      var statusCode;
      statusCode = '' + err.statusCode;
      if (statusCode === '404') {
        return false;
      }
      throw new Error("Error while inspecting image " + name + ": " + err);
    });
  }),
  checkForRunningContainer: Promise.method(function(name) {
    ensureDockerInit();
    return docker.getContainer(name).inspectAsync().then(function(containerInfo) {
      var ref, ref1;
      return (ref = containerInfo != null ? (ref1 = containerInfo.State) != null ? ref1.Running : void 0 : void 0) != null ? ref : false;
    })["catch"](function(err) {
      var statusCode;
      statusCode = '' + err.statusCode;
      if (statusCode === '404') {
        return false;
      }
      throw new Error("Error while inspecting container " + name + ": " + err);
    });
  }),
  buildImage: function(arg) {
    var baseDir, name, outStream;
    baseDir = arg.baseDir, name = arg.name, outStream = arg.outStream;
    return Promise["try"](function() {
      var tarStream;
      ensureDockerInit();
      if (outStream == null) {
        outStream = process.stdout;
      }
      tarStream = tar.pack(baseDir);
      return docker.buildImageAsync(tarStream, {
        t: "" + name
      });
    }).then(function(output) {
      return new Promise(function(resolve, reject) {
        return output.pipe(JSONStream.parse()).pipe(es.through(function(data) {
          var ref, ref1, str;
          if (data.error != null) {
            return reject(new Error(data.error));
          }
          if (data.stream != null) {
            str = data.stream + "\r";
          } else if ((ref = data.status) === 'Downloading' || ref === 'Extracting') {
            str = data.status + " " + ((ref1 = data.progress) != null ? ref1 : '') + "\r";
          } else {
            str = data.status + "\n";
          }
          if (str != null) {
            return this.emit('data', str);
          }
        }, function() {
          return resolve(true);
        })).pipe(outStream);
      });
    });
  },
  createContainer: function(name) {
    return Promise["try"](function() {
      ensureDockerInit();
      return docker.getImage(name).inspectAsync();
    }).then(function(imageInfo) {
      var cmd, ref;
      if (imageInfo != null ? (ref = imageInfo.Config) != null ? ref.Cmd : void 0 : void 0) {
        cmd = imageInfo.Config.Cmd;
      } else {
        cmd = ['/bin/bash', '-c', '/start'];
      }
      return docker.createContainerAsync({
        Image: name,
        Cmd: cmd,
        Tty: true,
        Volumes: defaultVolumes,
        name: name
      });
    });
  },
  startContainer: function(name) {
    return Promise["try"](function() {
      ensureDockerInit();
      return docker.getContainer(name).startAsync(getContainerStartOptions(name));
    })["catch"](function(err) {
      var statusCode;
      statusCode = '' + err.statusCode;
      if (statusCode !== '304') {
        throw new Error("Error while starting container " + name + ": " + err);
      }
    });
  },
  stopContainer: function(name) {
    return Promise["try"](function() {
      ensureDockerInit();
      return docker.getContainer(name).stopAsync({
        t: 10
      });
    })["catch"](function(err) {
      var statusCode;
      statusCode = '' + err.statusCode;
      if (statusCode !== '404' && statusCode !== '304') {
        throw new Error("Error while stopping container " + name + ": " + err);
      }
    });
  },
  removeContainer: function(name) {
    return Promise["try"](function() {
      ensureDockerInit();
      return docker.getContainer(name).removeAsync({
        v: true
      });
    })["catch"](function(err) {
      var statusCode;
      statusCode = '' + err.statusCode;
      if (statusCode !== '404') {
        throw new Error("Error while removing container " + name + ": " + err);
      }
    });
  },
  removeImage: function(name) {
    return Promise["try"](function() {
      ensureDockerInit();
      return docker.getImage(name).removeAsync({
        force: true
      });
    })["catch"](function(err) {
      var statusCode;
      statusCode = '' + err.statusCode;
      if (statusCode !== '404') {
        throw new Error("Error while removing image " + name + ": " + err);
      }
    });
  },
  inspectImage: function(name) {
    return Promise["try"](function() {
      ensureDockerInit();
      return docker.getImage(name).inspectAsync();
    });
  }
};
