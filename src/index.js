import _ from 'lodash';
import fs from 'fs-extra';
import {exec} from 'child_process';
import {basename, join, resolve as resolvePath} from 'path';
import pify from 'pify';
import {default as debugLib} from 'debug';

import transform from './transform';
import options from './options';

import {set as trackSet, track} from 'util/track';
import hrMillis from 'util/hrMillis';

function createDebugger(suffix){
  return debugLib(`serverless-plugin-iopipe:${suffix}`);
}

class ServerlessIOpipePlugin {
  constructor(sls = {}, opts) {
    this.sls = sls;
    this.setOptions(opts);
    this.prefix = opts.prefix || this.sls.config.servicePath || process.env.npm_config_prefix;
    trackSet(this);
    this.package = {};
    this.funcs = [];
    this.originalServicePath = this.sls.config.servicePath;
    this.commands = {
      iopipe: {
        usage: 'Automatically wraps your function handlers in IOpipe, so you don\'t have to.',
        lifecycleEvents: [
          'run'
        ]
      }
    };
    this.hooks = {
      'before:package:createDeploymentArtifacts': this.run.bind(this),
      'after:package:createDeploymentArtifacts': this.finish.bind(this),
      'iopipe:run': this.greeting.bind(this)
    };
  }
  log(arg1, ...rest){
    //sls doesn't actually support multiple args to log?
    const logger = this.sls.cli.log || console.log;
    logger.call(this.sls.cli, `serverless-plugin-iopipe: ${arg1}`, ...rest);
  }
  greeting(){
    this.log('Welcome to the IOpipe Serverless plugin.');
    const {token} = options();
    if (token){
      this.log('You have your token specified, so you are all set! Just run sls deploy for the magic.');
    } else {
      this.log('Whoops! You are missing the iopipeToken custom variable in your serverless.yml');
    }
  }
  async run(){
    const start = process.hrtime();
    track({
      action: 'run-start'
    });
    this.log('Wrapping your functions with IO|...');
    this.setPackage();
    this.checkForLocalPlugin();
    this.checkForLib();
    this.checkToken();
    this.upgradeLib();
    this.getFuncs();
    await this.setupFolder();
    this.transform();
    this.operate();
    track({
      action: 'run-finish',
      value: hrMillis(start)
    });
  }
  setPackage(){
    try {
      this.package = fs.readJsonSync(join(this.prefix, 'package.json'));
    } catch (err){
      this.package = {};
    }
  }
  setOptions(opts){
    const custom = _.chain(this.sls)
      .get('service.custom')
      .pickBy((val, key) => key.match(/^iopipe/))
      .mapKeys((val, key) => _.camelCase(key.replace(/^iopipe/, '')))
      .mapValues((val, key) => {
        if (key === 'exclude' && _.isString(val)){
          return val.split(',');
        }
        return val;
      })
      .value();
    const val = _.defaults(opts, custom);
    track({
      action: 'options-set',
      value: val
    });
    options(val);
  }
  checkForLocalPlugin(){
    const found = _.chain(join(this.prefix, 'node_modules'))
      .thru(fs.readdirSync)
      .includes('serverless-plugin-iopipe')
      .value();
    if (found){
      if (!options().preferLocal){
        track({
          action: 'plugin-installed-locally'
        });
        throw new Error('Found a folder named serverless-plugin-iopipe in node_modules. If you installed the plugin without the --global flag, your bundle size will be quite large as a result. If you are sure you want to do this, set iopipePreferLocal to true.');
      }
      return 'found-prefer-local';
    }
    return 'not-found';
  }
  checkForLib(pack = this.package){
    const {dependencies} = pack;
    if (_.isEmpty(pack) || !_.isPlainObject(pack)){
      track({
        action: 'no-package-skip-lib-check'
      });
      this.log('No package.json found, skipping lib check.');
      return 'no-package-skip';
    } else if (_.isPlainObject(pack) && !dependencies.iopipe){
      if (options().noVerify){
        this.log('Skipping iopipe module installation check.');
        return 'no-verify-skip';
      }
      track({
        action: 'lib-not-found'
      });
      throw new Error('IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.');
    }
    return true;
  }
  checkToken(){
    const token = options().token;
    if (!token){
      track({
        action: 'token-missing'
      });
      throw new Error('No iopipe token found. Specify "iopipeToken" in the "custom" object in serverless.yml.');
    }
    return true;
  }
  upgradeLib(targetVerison, preCmd = 'echo Installing.'){
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
      exec('npm outdated iopipe', (err1, stdout1 = '', stderr1 = '') => {
        if (stderr1 || err1){
          this.log('Could not finish upgrading IOpipe automatically.');
          track({
            action: 'npm-outdated-error',
            value: stderr1 || err1
          });
          return reject('err-npm-outdated');
        }
        const arr = stdout1.split('\n');
        debug('From npm outdated command: ', arr);
        const line2Arr = _.compact((arr[1] || '').split(' '));
        const libName = line2Arr[0];
        wantedVersion = targetVerison || line2Arr[2];
        if ((libName === 'iopipe' && wantedVersion) || targetVerison){
          // set version to newer
          debug(`Attempting to upgrade to ${wantedVersion}`);
          this.package.dependencies.iopipe = wantedVersion;
          // write package.json to file
          fs.writeFileSync(join(this.prefix, 'package.json'), JSON.stringify(this.package, null, '  '));
          debug(`Executing ${packageManager} install`);
          return exec(`${preCmd} && ${packageManager} install && echo $?`, (err2, stdout2 = '', stderr2 = '') => {
            if (err2){
              console.log(err2);
              return reject(err2);
            }
            const exitCode = _.chain(stdout2)
              .defaultTo('')
              .split('\n')
              .compact()
              .last()
              .value();
            if (exitCode === '0'){
              track({
                action: 'lib-upgrade-success',
                value: stderr1 || err1
              });
              this.log(`Upgraded IOpipe to ${wantedVersion} automatically. 💪`);
              return resolve(`success-upgrade-${packageManager}-${wantedVersion}`);
            }
            this.log('Ran into an error attempting to upgrade IOpipe automatically.');
            const err = stderr2 || stderr1 || 'Unknown error.';
            this.log(err);
            track({
              action: 'lib-upgrade-error',
              value: err
            });
            return reject(`err-install-${packageManager}`);
          });
        } else if (!libName){
          this.log('You have the latest IOpipe library. Nice work!');
          return resolve(`success-no-upgrade-${packageManager}`);
        }
        this.log('Something went wrong trying to upgrade IOpipe automatically.');
        track({
          action: 'lib-upgrade-error',
          value: 'unknown'
        });
        return reject('err-unknown');
      });
    });
  }
  getFuncs(){
    try {
      const {servicePath} = this.sls.config;
      this.funcs = _.chain(this.sls.service.functions)
        .omit(options().exclude)
        .toPairs()
        //filter out functions that are not Node.js
        .reject(arr => {
          const key = arr[0];
          const obj = arr[1];
          if (_.isString(obj.runtime) && !obj.runtime.match('node')){
            this.log(`Function "${key}" is not Node.js. Currently the plugin only supports Node.js functions. Skipping ${key}.`);
            return true;
          }
          return false;
        })
        .map(arr => {
          const key = arr[0];
          const obj = arr[1];
          const handlerArr = _.isString(obj.handler) ? obj.handler.split('.') : [];
          const relativePath = handlerArr.slice(0, -1).join('.');
          const path = `${servicePath}/${relativePath}.js`;
          return _.assign({}, obj, {
            method: _.last(handlerArr),
            path,
            code: fs.readFileSync(path, 'utf8'),
            name: key,
            relativePath
          });
        })
        .value();
      track({
        action: 'funcs-count',
        value: this.funcs.length
      });
    } catch (err){
      track({
        action: 'get-funcs-fail',
        value: err
      });
      console.error('Failed to require functions.');
      throw new Error(err);
    }
  }
  async setupFolder(){
    const debug = createDebugger('setupFolder');
    const iopipeFolder = resolvePath(this.prefix, '.iopipe');
    fs.removeSync(iopipeFolder);
    fs.ensureDirSync(join(this.originalServicePath, '.serverless'));
    const files = _.chain(this.prefix)
      .thru(fs.readdirSync)
      .difference(['node_modules', '.iopipe'])
      .value();
    debug('files to copy: ', JSON.stringify(files));
    fs.ensureDirSync(resolvePath(this.prefix, '.iopipe'));
    const copy = pify(fs.copy);
    try {
      await Promise.all(files.map(file => {
        return copy(resolvePath(this.prefix, file), resolvePath(this.prefix, '.iopipe/', file));
      }));
      fs.symlinkSync(resolvePath(this.prefix, 'node_modules'), resolvePath(this.prefix, '.iopipe/node_modules'));
      this.sls.config.servicePath = join(this.originalServicePath, '.iopipe');
    } catch (err){
      this.log(err);
    }
  }
  transform(){
    if (_.isArray(this.funcs) && this.funcs.length){
      this.funcs = this.funcs.map(f => transform(f, this.sls));
      return true;
    }
    throw new Error('No functions to wrap iopipe with.');
  }
  operate(){
    this.funcs.forEach(f => {
      fs.writeFileSync(join(this.sls.config.servicePath, f.relativePath + '.js'), f.transformed);
    });
  }
  finish(){
    this.log('Successfully wrapped Node.js functions with IOpipe, cleaning up.');
    fs.copySync(
      join(this.originalServicePath, '.iopipe', '.serverless'),
      join(this.originalServicePath, '.serverless')
    );
    this.sls.service.package.artifact = join(this.originalServicePath, '.serverless', basename(this.sls.service.package.artifact));
    this.sls.config.servicePath = this.originalServicePath;
    fs.removeSync(join(this.originalServicePath, '.iopipe'));
    track({
      action: 'finish'
    });
  }
}

module.exports = ServerlessIOpipePlugin;
