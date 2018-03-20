import { exec } from 'child_process';
import { join } from 'path';
import _ from 'lodash';
import fs from 'fs-extra';
import debugLib from 'debug';
import cosmiconfig from 'cosmiconfig';

import { getVisitor, track } from './util/track';
import hrMillis from './util/hrMillis';
import handlerCode from './handlerCode';

function createDebugger(suffix) {
  return debugLib(`serverless-plugin-iopipe:${suffix}`);
}

function outputHandlerCode(obj = {}, index) {
  const { name, relativePath, method } = obj;
  const fnName = _.camelCase(`attempt-${name}`) + index;
  return handlerCode
    .replace(/EXPORT_NAME/g, name)
    .replace(/FUNCTION_NAME/g, fnName)
    .replace(/RELATIVE_PATH/g, relativePath)
    .replace(/METHOD/g, method);
}

function getExitCode(stdout) {
  return _.chain(stdout)
    .defaultTo('')
    .split('\n')
    .compact()
    .last()
    .value();
}

function getUpgradeVersion({
  packageManager,
  suppliedTargetVersion,
  debug,
  installed,
  preCmd = ''
}) {
  return new Promise((resolve, reject) => {
    exec(
      `${preCmd}${preCmd &&
        ' && '}${packageManager} outdated ${installed} && echo $?`,
      (err, stdout = '', stderr = '') => {
        _.noop(err);
        const stdoutLines = _.chain(stdout)
          .split('\n')
          .map(s => _.trim(s))
          .value();
        const publishedVersions = _.chain(stdoutLines)
          .find((str = '') => str.match(installed))
          .split(' ')
          .compact()
          .slice(1, 4)
          .value();
        const [current, wanted, latest] = publishedVersions;
        // auto-upgrade to 1.0 since its major, but non-breaking
        const version =
          suppliedTargetVersion ||
          (current !== latest && latest.match(/^1\./) && latest) ||
          wanted;
        debug(`From ${packageManager} outdated command: `, stdoutLines);
        if (version) {
          return resolve(version);
        } else if (getExitCode(stdout) === '0') {
          return resolve(true);
        }
        return reject(stderr);
      }
    );
  });
}

function runUpgrade(pluginInstance, packageManager, version, preCmd, debug) {
  return new Promise((resolve, reject) => {
    debug(`Attempting to upgrade to ${version}`);
    // write package.json to file
    fs.writeFileSync(
      join(pluginInstance.prefix, 'package.json'),
      JSON.stringify(pluginInstance.package, null, '  ')
    );
    debug(`Executing ${packageManager} install`);
    return exec(
      `${preCmd} && ${packageManager} install && echo $?`,
      (err, stdout = '', stderr = '') => {
        if (err) {
          return reject(err);
        }
        return getExitCode(stdout) === '0' ? resolve(true) : reject(stderr);
      }
    );
  });
}

class ServerlessIOpipePlugin {
  constructor(sls = {}, opts) {
    this.sls = sls;
    this.prefix =
      opts.prefix ||
      this.sls.config.servicePath ||
      process.env.npm_config_prefix;
    this.visitor = getVisitor(this);
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
      'before:invoke:local:invoke': this.run.bind(this),
      'after:package:createDeploymentArtifacts': this.finish.bind(this),
      'after:invoke:local:invoke': this.finish.bind(this),
      'iopipe:run': this.greeting.bind(this)
    };
  }

  getOptions(obj = this.options) {
    this.options = _.chain(obj)
      .defaults(this.options)
      .defaults({
        quote: 'single'
      })
      .mapKeys((val, key) => _.camelCase(key))
      .value();
    return this.options;
  }

  getInstalledPackageName({ dependencies } = this.package) {
    return ['@iopipe/iopipe', '@iopipe/core', 'iopipe'].find(s =>
      _.keys(dependencies).find(n => n === s)
    );
  }

  log(arg1, ...rest) {
    //sls doesn't actually support multiple args to log?
    /*eslint-disable no-console*/
    const logger = this.sls.cli.log || console.log;
    /*eslint-enable no-console*/
    logger.call(this.sls.cli, `serverless-plugin-iopipe: ${arg1}`, ...rest);
  }

  track(kwargs) {
    return track(this, kwargs);
  }

  greeting() {
    this.log(
      'Welcome to the IOpipe Serverless plugin. You can use this plugin for sls invoke local or sls deploy. Make sure you have the $IOPIPE_TOKEN environment variable set documented here: https://github.com/iopipe/serverless-plugin-iopipe#install.'
    );
  }

  async run() {
    const start = process.hrtime();

    this.setOptions({});

    this.track({
      action: 'run-start'
    });

    this.log('Wrapping your functions with IO|...');

    this.setPackage();
    this.checkForLib();
    this.checkToken();
    await this.upgradeLib();
    this.getFuncs();
    this.createFile();
    this.assignHandlers();

    this.track({
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
    this.track({
      action: 'options-set',
      value: val
    });
    this.getOptions(val);
  }

  checkForLib(pack = this.package) {
    const installed = this.getInstalledPackageName(pack);
    if (_.isEmpty(pack) || !_.isPlainObject(pack)) {
      this.track({
        action: 'no-package-skip-lib-check'
      });
      this.log('No package.json found, skipping lib check.');
      return 'no-package-skip';
    } else if (_.isPlainObject(pack) && !installed) {
      if (this.getOptions().noVerify) {
        this.log('Skipping iopipe module installation check.');
        return 'no-verify-skip';
      }
      this.track({
        action: 'lib-not-found'
      });
      throw new Error(
        'IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.'
      );
    }
    return true;
  }

  checkToken() {
    const token = this.getOptions().token;
    if (!token) {
      const msg =
        'You did not specify iopipeToken in your custom section of serverless.yml. iopipe will fall back to $IOPIPE_TOKEN in the lambda environment';
      this.log(msg);
      return msg;
    }
    return true;
  }

  async upgradeLib(suppliedTargetVersion, preCmd = 'echo Installing.') {
    if (this.getOptions().noUpgrade) {
      return 'no-upgrade';
    }
    const debug = createDebugger('upgrade');
    const files = fs.readdirSync(this.prefix);
    const useYarn = _.includes(files, 'yarn.lock');
    const packageManager = useYarn ? 'yarn' : 'npm';
    debug(`Using pkg manager: ${packageManager}`);
    this.track({
      action: 'lib-upgrade',
      label: packageManager
    });
    let version;

    // Get the version of iopipe that we need to upgrade to, if necessary
    try {
      version = await getUpgradeVersion({
        packageManager,
        suppliedTargetVersion,
        debug,
        installed: this.getInstalledPackageName(),
        preCmd
      });
      if (version === true) {
        this.log('You have the latest IOpipe library. Nice work!');
        return `success-no-upgrade-${packageManager}`;
      }
    } catch (err) {
      this.log('Could not finish upgrading IOpipe automatically.');
      debug(`Err from ${packageManager} outdated:`, err);
      this.track({
        action: `${packageManager}-outdated-error`,
        value: err
      });
      return `${packageManager}-outdated-error`;
    }

    // If we have a version that we now need to upgrade to, lets upgrade
    try {
      this.package.dependencies.iopipe = version;
      await runUpgrade(this, packageManager, version, preCmd, debug);
    } catch (err) {
      this.log(err);
      this.track({
        action: 'lib-upgrade-error',
        value: err
      });
      return `err-install-${packageManager}`;
    }
    this.track({
      action: 'lib-upgrade-success',
      value: true
    });
    this.log(`Upgraded IOpipe to ${version} automatically. 💪`);
    return `success-upgrade-${packageManager}-${version}`;
  }

  getFuncs() {
    try {
      const { servicePath } = this.sls.config;
      this.funcs = _.chain(this.sls.service.functions)
        .omit(this.getOptions().exclude)
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
      this.track({
        action: 'funcs-count',
        value: this.funcs.length
      });
    } catch (err) {
      this.track({
        action: 'get-funcs-fail',
        value: err
      });
      /*eslint-disable no-console*/
      console.error('Failed to read functions from serverless.yml.');
      /*eslint-enable no-console*/
      throw new Error(err);
    }
  }

  getConfigFromCosmi() {
    const { token } = this.getOptions();
    const { config: cosmi = {} } =
      cosmiconfig('iopipe', {
        cache: false,
        sync: true,
        rcExtensions: true
      }).load(process.cwd()) || {};
    const requireLines = _.chain(cosmi.plugins)
      .map(p => `require('${p}');\n`)
      .join('')
      .defaultTo('')
      .value();
    const inlineConfigObject = _.pickBy(_.assign({}, cosmi, { token }));
    const inlineConfig = _.isEmpty(inlineConfigObject)
      ? ''
      : JSON.stringify(inlineConfigObject);
    return {
      requireLines,
      inlineConfig
    };
  }

  createFile() {
    const debug = createDebugger('createFile');
    debug('Creating file');

    const { inlineConfig, requireLines } = this.getConfigFromCosmi();
    const iopipeInclude = `${requireLines}const iopipe = require('${this.getInstalledPackageName()}')(${inlineConfig});`;
    const funcContents = _.chain(this.funcs)
      .map(outputHandlerCode)
      .join('\n')
      .value();
    const contents = `${iopipeInclude}\n\n${funcContents}`;

    fs.writeFileSync(
      join(this.originalServicePath, `${this.handlerFileName}.js`),
      contents
    );

    return contents;
  }

  assignHandlers() {
    const debug = createDebugger('assignHandlers');
    debug('Assigning iopipe handlers to sls service');

    this.funcs.forEach(func => {
      _.set(
        this.sls.service.functions,
        `${func.name}.handler`,
        `${this.handlerFileName}.${func.name}`
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
    this.track({
      action: 'finish'
    })
      .then(_.noop)
      .catch(debug);
  }
}

module.exports = ServerlessIOpipePlugin;
