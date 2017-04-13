import _ from 'lodash';
import fs from 'fs-extra';
import {join} from 'path';
import {exec} from 'child_process';

import transform from './transform';
import options from './options';

class ServerlessIOpipePlugin {
  constructor(sls, opts) {
    this.sls = sls;
    this.setOptions(opts);
    this.package = {};
    this.funcs = [];
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
    this.sls.cli.log(`serverless-plugin-iopipe: ${arg1}`, ...rest);
  }
  run(){
    this.log('Wrapping your functions with IO|...', 'wow!', 'really fun stuff');
    this.setPackage();
    this.checkForLib();
    this.upgradeLib();
    this.checkToken();
    this.getFuncs();
    this.transform();
    this.operate();
  }
  setPackage(){
    const prefix = process.env.npm_config_prefix;
    if (prefix){
      try {
        this.package = JSON.parse(fs.readFileSync(join(prefix, 'package.json')));
      } catch (err){
        _.noop();
      }
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
  checkForLib(){
    const prefix = process.env.npm_config_prefix;
    let dependencies = {};
    if (prefix){
      try {
        dependencies = JSON.parse(fs.readFileSync(join(prefix, 'package.json'))).dependencies;
      } catch (err){
        this.log('No package.json found, skipping lib check.');
        return true;
      }
      if (!dependencies.iopipe){
        if (options().noVerify){
          this.log('Skipping iopipe module installation check.');
          return true;
        }
        throw new Error('IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.');
      }
    }
    return true;
  }
  upgradeLib(){
    const prefix = process.env.npm_config_prefix;
    const files = fs.readdirSync(prefix);
    const useYarn = _.includes(files, 'yarn.lock');
    const packageManager = useYarn ? 'yarn' : 'npm';
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
        fs.writeFileSync(join(prefix, 'package.json'), JSON.stringify(this.package, null, '  '));
        exec(`${packageManager} install`, (e2, stdout2 = '', stderr2 = '') => {
          if (useYarn && stdout2.match('success') || !useYarn && !stderr1){
            return this.log(`Upgraded IOpipe to ${wantedVersion} automatically. 💪`);
          }
          this.log('Ran into an error attempting to upgrade IOpipe automatically.');
          const err = stderr2 || stderr1 || 'Unknown error.';
          return this.log(err);
        });
      } else if (!libName){
        return this.log('You have the latest IOpipe library. Nice work!');
      }
      return true;
    });
  }
  checkToken(){
    const token = options().token;
    if (!token){
      throw new Error('No iopipe token found. Specify "iopipeToken" in the "custom" object in serverless.yml.');
    }
  }
  getFuncs(){
    try {
      const {servicePath} = this.sls.config;
      this.funcs = _.chain(this.sls.service.functions)
        .omit(options().exclude)
        .values()
        .map(obj => {
          const handlerArr = _.isString(obj.handler) ? obj.handler.split('.') : [];
          const fileName = handlerArr.slice(0, -1).join('.');
          const path = `${servicePath}/${fileName}.js`;
          return _.assign({}, obj, {
            method: _.last(handlerArr),
            path,
            code: fs.readFileSync(path, 'utf8')
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
  operate(){
    this.funcs.forEach(f => {
      fs.writeFileSync(`${f.path}.original.js`, f.code);
      fs.writeFileSync(f.path, f.transformed);
    });
  }
  finish(){
    this.log('Successfully wrapped functions with IOpipe, cleaning up.');
    this.funcs.forEach(f => {
      fs.writeFileSync(f.path, f.code);
      fs.removeSync(`${f.path}.original.js`);
    });
  }
}

module.exports = ServerlessIOpipePlugin;
