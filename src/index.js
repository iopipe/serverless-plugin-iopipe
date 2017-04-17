import _ from 'lodash';
import fs from 'fs-extra';
import {exec} from 'child_process';
import {basename, join, resolve} from 'path';
import CJSON from 'circular-json';
import pify from 'pify';

import transform from './transform';
import options from './options';

class ServerlessIOpipePlugin {
  constructor(sls = {}, opts) {
    this.sls = sls;
    this.setOptions(opts);
    this.package = {};
    this.funcs = [];
    this.prefix = opts.prefix || process.env.npm_config_prefix;
    this.originalServicePath = this.sls.config.servicePath;
    this.commands = {
      iopipe: {
        usage: 'Automatically wraps your function handlers in IOpipe, so you don\'t have to.',
        lifecycleEvents: [
          'run',
          'finish'
        ],
        options: {
          token: {
            usage:
              'Your iopipe token (clientId) to wrap your functions with',
            required: false,
            shortcut: 't'
          },
          quote: {
            usage:
              'Use "single" or "double" quotes in transformed output',
            required: false,
            shortcut: 'q'
          },
          noVerify: {
            usage:
              'Skip a check that ensures iopipe is installed via npm/yarn and present in package.json',
            required: false,
            shortcut: 'nv'
          },
          noUpgrade: {
            usage:
              'The plugin automatically upgrades the IOpipe library to the most recent minor version. Use this option to disable that feature.',
            required: false,
            shortcut: 'nu'
          },
          noYarn: {
            usage:
              'When auto-upgrading, Yarn will be used in place of NPM if a yarn.lock file is found. Use this flag disable yarn and use NPM to upgrade the iopipe library.',
            required: false,
            shortcut: 'ny'
          },
          exclude: {
            usage:
              'Exclude certain handlers from being wrapped with IOpipe',
            required: false,
            shortcut: 'e'
          },
          placeholder: {
            usage:
              'Use process.env.IOPIPE_TOKEN as a placeholder variable to allow the token to be configured via environment variables in Serverless, AWS CLI, or AWS Console',
            required: false,
            shortcut: 'p'
          }
        }
      }
    };
    this.hooks = {
      'before:deploy:createDeploymentArtifacts': this.run.bind(this),
      'after:deploy:compileFunctions': this.finish.bind(this),
      'iopipe:run': this.run.bind(this),
      'iopipe:finish': this.finish.bind(this)
    };
  }
  log(arg1, ...rest){
    //sls doesn't actually support multiple args to log? w/e
    const logger = this.sls.cli.log || console.log;
    logger.call(this.sls.cli, `serverless-plugin-iopipe: ${arg1}`, ...rest);
  }
  async run(){
    this.log('Wrapping your functions with IO|...');
    this.setPackage();
    this.checkForLib();
    this.checkToken();
    this.upgradeLib();
    this.getFuncs();
    await this.setupFolder();
    this.transform();
    this.operate();
  }
  setPackage(){
    try {
      this.package = JSON.parse(fs.readFileSync(join(this.prefix, 'package.json')));
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
    options(_.defaults(opts, custom));
  }
  checkForLib(pack = this.package){
    const {dependencies} = pack;
    if (_.isEmpty(pack) || !_.isPlainObject(pack)){
      this.log('No package.json found, skipping lib check.');
      return 'no-package-skip';
    } else if (_.isPlainObject(pack) && !dependencies.iopipe){
      if (options().noVerify){
        this.log('Skipping iopipe module installation check.');
        return 'no-verify-skip';
      }
      throw new Error('IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.');
    }
    return true;
  }
  checkToken(){
    const token = options().token;
    if (!token){
      throw new Error('No iopipe token found. Specify "iopipeToken" in the "custom" object in serverless.yml.');
    }
    return true;
  }
  upgradeLib(){
    const files = fs.readdirSync(this.prefix);
    const useYarn = _.includes(files, 'yarn.lock');
    const packageManager = useYarn ? 'yarn' : 'npm';
    console.log(packageManager);
    exec('npm outdated iopipe', (e, stdout1 = '', stderr1 = '') => {
      if (stderr1){
        this.log('Could not finish upgrading IOpipe automatically.');
        return true;
      }
      const arr = stdout1.split('\n');
      const line2Arr = _.compact((arr[1] || '').split(' '));
      const libName = line2Arr[0];
      const wantedVersion = line2Arr[3];
      if (libName === 'iopipe' && wantedVersion){
        // set version to newer
        this.package.dependencies.iopipe = wantedVersion;
        // write package.json to file
        fs.writeFileSync(join(this.prefix, 'package.json'), JSON.stringify(this.package, null, '  '));
        exec(`${packageManager} install`, (e2, stdout2 = '', stderr2 = '') => {
          if (useYarn && stdout2.match('success') || !useYarn && !stderr1){
            return this.log(`Upgraded IOpipe to ${wantedVersion} automatically. 💪`);
          }
          this.log('Ran into an error attempting to upgrade IOpipe automatically.');
          const err = stderr2 || stderr1 || 'Unknown error.';
          return this.log(err);
        });
      } else if (!libName){
        this.log('You have the latest IOpipe library. Nice work!');
        return 'latest';
      }
      return this.log('Something went wrong trying to upgrade IOpipe automatically.');
    });
  }
  getFuncs(){
    try {
      const {servicePath} = this.sls.config;
      this.funcs = _.chain(this.sls.service.functions)
        .omit(options().exclude)
        .toPairs()
        .map(arr => {
          const key = arr[0];
          const obj = arr[1];
          const handlerArr = _.isString(obj.handler) ? obj.handler.split('.') : [];
          const fileName = handlerArr.slice(0, -1).join('.');
          const path = `${servicePath}/${fileName}.js`;
          return _.assign({}, obj, {
            method: _.last(handlerArr),
            path,
            code: fs.readFileSync(path, 'utf8'),
            name: key,
            fileName
          });
        })
        .value();
    } catch (err){
      console.error('Failed to require functions.');
      throw new Error(err);
    }
  }
  transform(){
    if (_.isArray(this.funcs) && this.funcs.length){
      this.funcs = this.funcs.map(f => transform(f, this.sls));
      return true;
    }
    throw new Error('No functions to wrap iopipe with.');
  }
  async setupFolder(){
    const iopipeFolder = resolve(this.prefix, '.iopipe');
    fs.removeSync(iopipeFolder);
    const files = _.chain(this.prefix)
      .thru(fs.readdirSync)
      .difference(['node_modules', '.iopipe'])
      .value();
    console.log(files);
    // console.log(CJSON.stringify(this.sls));
    fs.ensureDir(resolve(this.prefix, '.iopipe'));
    const copy = pify(fs.copy);
    try {
      await Promise.all(files.map(file => {
        return copy(resolve(this.prefix, file), resolve(this.prefix, '.iopipe/', file));
      }));
      this.sls.config.servicePath = join(this.originalServicePath, '.iopipe');
    } catch (err){
      this.log(err);
    }
  }
  operate(){
    this.funcs.forEach(f => {
      // this.sls.functions[f.name].handler = basename(f.handler);
      // console.log(this.sls.service.functions[f.name]);
      fs.writeFileSync(join(this.sls.config.servicePath, f.fileName + '.js'), f.transformed);
    });
  }
  finish(){
    this.log('Successfully wrapped functions with IOpipe, cleaning up.');
    console.log(CJSON.stringify(this.sls));
    // this.sls.config.servicePath =
    // fs.removeSync(join(this.originalServicePath, '.iopipe'));
  }
}

module.exports = ServerlessIOpipePlugin;
