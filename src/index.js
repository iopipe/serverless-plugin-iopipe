import _ from 'lodash';
import fs from 'fs-extra';
import {join} from 'path';

import transform from './transform';
import options from './options';

let funcs = [];

class ServerlessIOpipePlugin {
  constructor(sls, opts) {
    this.sls = sls;
    this.setOptions(opts);
    this.commands = {
      iopipe: {
        usage: 'Helps you start your first Serverless plugin',
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
  run(){
    this.sls.cli.log('Wrapping your functions with IO|...');
    this.setOptions();
    this.checkForLib();
    this.checkToken();
    this.getFuncs();
    this.transform();
    this.operate();
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
    if (prefix){
      const {dependencies = {}} = JSON.parse(fs.readFileSync(join(prefix, 'package.json')));
      if (!dependencies.iopipe){
        if (options().noVerify){
          return this.sls.cli.log('Skipping iopipe module installation check.');
        }
        throw new Error('IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.');
      }
    }
    return true;
  }
  checkToken(){
    const token = options().token;
    if (!token){
      throw new Error('No iopipe token found. Specify in the "custom" object in serverless.yml or use the --token flag.');
    }
  }
  getFuncs(){
    try {
      const {servicePath} = this.sls.config;
      funcs = _.chain(this.sls.service.functions)
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
    if (_.isArray(funcs) && funcs.length){
      funcs = funcs.map(f => transform(f, this.sls));
      return true;
    }
    throw new Error('No functions to wrap iopipe with.');
  }
  operate(){
    funcs.forEach(f => {
      fs.writeFileSync(`${f.path}.original.js`, f.code);
      fs.writeFileSync(f.path, f.transformed);
    });
  }
  finish(){
    this.sls.cli.log('Successfully wrapped functions with IOpipe, cleaning up.');
    funcs.forEach(f => {
      fs.writeFileSync(f.path, f.code);
      fs.removeSync(`${f.path}.original.js`);
    });
  }
}

module.exports = ServerlessIOpipePlugin;
