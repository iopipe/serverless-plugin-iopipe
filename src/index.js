import _ from 'lodash';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { join } from 'path';
import { default as debugLib } from 'debug';

import options from './options';

import { set as trackSet, track } from './util/track';
import hrMillis from './util/hrMillis';

function createDebugger(suffix) {
  return debugLib(`serverless-plugin-iopipe:${suffix}`);
}

class ServerlessIOpipePlugin {
  constructor(sls = {}, opts) {
    this.sls = sls;
    this.setOptions(opts);
    this.prefix =
      opts.prefix ||
      this.sls.config.servicePath ||
      process.env.npm_config_prefix;
    trackSet(this);
    this.package = {};
    this.funcs = [];
    this.originalServicePath = this.sls.config.servicePath;
    this.handlerFileName = 'iopipe-handlers';
    this.commands = {
      iopipe: {
        usage:
          "Automatically wraps your function handlers in IOpipe, so you don't have to.",
        lifecycleEvents: ['run']
      }
    };
    this.hooks = {
      'before:package:createDeploymentArtifacts': this.run.bind(this),
      'after:package:createDeploymentArtifacts': this.finish.bind(this),
      'iopipe:run': this.greeting.bind(this)
    };
  }
  log(arg1, ...rest) {
    //sls doesn't actually support multiple args to log?
    const logger = this.sls.cli.log || console.log;
    logger.call(this.sls.cli, `serverless-plugin-iopipe: ${arg1}`, ...rest);
  }
  greeting() {
    this.log('Welcome to the IOpipe Serverless plugin.');
    const { token } = options();
    if (token) {
      this.log(
        'You have your token specified, so you are all set! Just run sls deploy for the magic.'
      );
    } else {
      this.log(
        'Whoops! You are missing the iopipeToken custom variable in your serverless.yml'
      );
    }
  }
  async run() {
    const start = process.hrtime();
    track({
      action: 'run-start'
    });
    this.log('Wrapping your functions with IO|...');
    this.setPackage();
    this.checkForLib();
    this.checkToken();
    this.upgradeLib();
    this.getFuncs();
    this.createFile();
    this.assignHandlers();
    track({
      action: 'run-finish',
      value: hrMillis(start)
    });
  }
  setPackage() {
    try {
      this.package = fs.readJsonSync(join(this.prefix, 'package.json'));
    } catch (err) {
      this.package = {};
    }
  }
  setOptions(opts) {
    const debug = createDebugger('setOptions');
    const custom = _.chain(this.sls)
      .get('service.custom')
      .pickBy((val, key) => key.match(/^iopipe/))
      .mapKeys((val, key) => _.camelCase(key.replace(/^iopipe/, '')))
      .mapValues((val, key) => {
        if (key === 'exclude' && _.isString(val)) {
          return val.split(',');
        }
        return val;
      })
      .value();
    const envVars = _.chain(process.env)
      .pickBy((val, key) => key.match(/^IOPIPE/))
      .mapKeys((val, key) => _.camelCase(key.replace(/^IOPIPE/, '')))
      .value();
    const val = _.defaults(opts, custom, envVars);
    debug('Options object:', val);
    track({
      action: 'options-set',
      value: val
    });
    options(val);
  }
  checkForLib(pack = this.package) {
    const { dependencies } = pack;
    if (_.isEmpty(pack) || !_.isPlainObject(pack)) {
      track({
        action: 'no-package-skip-lib-check'
      });
      this.log('No package.json found, skipping lib check.');
      return 'no-package-skip';
    } else if (_.isPlainObject(pack) && !dependencies.iopipe) {
      if (options().noVerify) {
        this.log('Skipping iopipe module installation check.');
        return 'no-verify-skip';
      }
      track({
        action: 'lib-not-found'
      });
      throw new Error(
        'IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.'
      );
    }
    return true;
  }
  checkToken() {
    const token = options().token;
    if (!token) {
      track({
        action: 'token-missing'
      });
      throw new Error(
        'No iopipe token found. Specify "iopipeToken" in the "custom" object in serverless.yml.'
      );
    }
    return true;
  }
  upgradeLib(targetVerison, preCmd = 'echo Installing.') {
    if (options().noUpgrade) {
      return 'no-upgrade';
    }
    const debug = createDebugger('upgrade');
    let wantedVersion = targetVerison;
    const files = fs.readdirSync(this.prefix);
    const useYarn = _.includes(files, 'yarn.lock');
    const packageManager = useYarn ? 'yarn' : 'npm';
    debug(`Using pkg manager: ${packageManager}`);
    track({
      action: 'lib-upgrade',
      label: packageManager
    });
    return new Promise((resolve, reject) => {
      exec(
        `${packageManager} outdated iopipe`,
        (err1, stdout1 = '', stderr1 = '') => {
          if (stderr1 || err1) {
            this.log('Could not finish upgrading IOpipe automatically.');
            debug(`Err from ${packageManager} outdated:`, stderr1 || err1);
            track({
              action: `${packageManager}-outdated-error`,
              value: stderr1 || err1
            });
            return reject('err-npm-outdated');
          }
          const arr = stdout1.split('\n');
          debug(`From ${packageManager} outdated command: `, arr);
          const line2Arr = _.compact(
            (arr[packageManager === 'yarn' ? 2 : 1] || '').split(' ')
          );
          const libName = line2Arr[0];
          wantedVersion = targetVerison || line2Arr[2];
          if ((libName === 'iopipe' && wantedVersion) || targetVerison) {
            // set version to newer
            debug(`Attempting to upgrade to ${wantedVersion}`);
            this.package.dependencies.iopipe = wantedVersion;
            // write package.json to file
            fs.writeFileSync(
              join(this.prefix, 'package.json'),
              JSON.stringify(this.package, null, '  ')
            );
            debug(`Executing ${packageManager} install`);
            return exec(
              `${preCmd} && ${packageManager} install && echo $?`,
              (err2, stdout2 = '', stderr2 = '') => {
                if (err2) {
                  console.log(err2);
                  return reject(err2);
                }
                const exitCode = _.chain(stdout2)
                  .defaultTo('')
                  .split('\n')
                  .compact()
                  .last()
                  .value();
                if (exitCode === '0') {
                  track({
                    action: 'lib-upgrade-success',
                    value: stderr1 || err1
                  });
                  this.log(
                    `Upgraded IOpipe to ${wantedVersion} automatically. 💪`
                  );
                  return resolve(
                    `success-upgrade-${packageManager}-${wantedVersion}`
                  );
                }
                this.log(
                  'Ran into an error attempting to upgrade IOpipe automatically.'
                );
                const err = stderr2 || stderr1 || 'Unknown error.';
                this.log(err);
                track({
                  action: 'lib-upgrade-error',
                  value: err
                });
                return reject(`err-install-${packageManager}`);
              }
            );
          } else if (!libName) {
            this.log('You have the latest IOpipe library. Nice work!');
            return resolve(`success-no-upgrade-${packageManager}`);
          }
          this.log(
            'Something went wrong trying to upgrade IOpipe automatically.'
          );
          track({
            action: 'lib-upgrade-error',
            value: 'unknown'
          });
          return reject('err-unknown');
        }
      );
    });
  }
  getFuncs() {
    try {
      const { servicePath } = this.sls.config;
      this.funcs = _.chain(this.sls.service.functions)
        .omit(options().exclude)
        .toPairs()
        //filter out functions that are not Node.js
        .reject(arr => {
          const key = arr[0];
          const obj = arr[1];
          if (_.isString(obj.runtime) && !obj.runtime.match('node')) {
            this.log(
              `Function "${key}" is not Node.js. Currently the plugin only supports Node.js functions. Skipping ${key}.`
            );
            return true;
          }
          return false;
        })
        .map(arr => {
          const key = arr[0];
          const obj = arr[1];
          const handlerArr = _.isString(obj.handler)
            ? obj.handler.split('.')
            : [];
          const relativePath = handlerArr.slice(0, -1).join('.');
          const path = `${servicePath}/${relativePath}.js`;
          return _.assign({}, obj, {
            method: _.last(handlerArr),
            path,
            name: key,
            relativePath
          });
        })
        .value();
      track({
        action: 'funcs-count',
        value: this.funcs.length
      });
    } catch (err) {
      track({
        action: 'get-funcs-fail',
        value: err
      });
      console.error('Failed to read functions from serverless.yml.');
      throw new Error(err);
    }
  }
  createFile() {
    const debug = createDebugger('createFile');
    debug('Creating file');
    const iopipeInclude = `const iopipe = require('iopipe')({token: '${options()
      .token}'});`;
    const funcContents = _.chain(this.funcs)
      .map((obj, index) => {
        return `exports['${obj.name}'] = function ${_.camelCase(
          'attempt-' + obj.name
        )}${index}(event, context, callback) {
  try {
    return iopipe(require('./${obj.relativePath}').${obj.method})(event, context, callback);
  } catch (err) {
    throw err;
  }
};
`;
      })
      .join('\n')
      .value();
    const contents = `${iopipeInclude}\n\n${funcContents}`;
    fs.writeFileSync(
      join(this.originalServicePath, `${this.handlerFileName}.js`),
      contents
    );
  }
  assignHandlers() {
    const debug = createDebugger('assignHandlers');
    debug('Assigning iopipe handlers to sls service');
    this.funcs.forEach(obj => {
      _.set(
        this.sls.service.functions,
        `${obj.name}.handler`,
        `${this.handlerFileName}.${obj.name}`
      );
    });
  }
  finish() {
    const debug = createDebugger('finish');
    this.log(
      'Successfully wrapped Node.js functions with IOpipe, cleaning up.'
    );
    debug(`Removing ${this.handlerFileName}.js`);
    fs.removeSync(join(this.originalServicePath, `${this.handlerFileName}.js`));
    track({
      action: 'finish'
    })
      .then(_.noop)
      .catch(debug);
  }
}

module.exports = ServerlessIOpipePlugin;
