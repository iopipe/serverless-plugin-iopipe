'use strict';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _transform = require('./transform');

var _transform2 = _interopRequireDefault(_transform);

var _options = require('./options');

var _options2 = _interopRequireDefault(_options);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let funcs = [];

class ServerlessIOpipePlugin {
  constructor(sls, opts) {
    this.sls = sls;
    this.setOptions(opts);
    this.commands = {
      iopipe: {
        usage: 'Helps you start your first Serverless plugin',
        lifecycleEvents: ['run', 'finish'],
        options: {
          token: {
            usage: 'Your iopipe token (clientId) to wrap your functions with',
            required: false,
            shortcut: 't'
          },
          quote: {
            usage: 'Use "single" or "double" quotes in transformed output',
            required: false,
            shortcut: 'q'
          },
          noVerify: {
            usage: 'Skip a check that ensures iopipe is installed via npm/yarn and present in package.json',
            required: false,
            shortcut: 'nv'
          },
          exclude: {
            usage: 'Exclude certain handlers from being wrapped with IOpipe',
            required: false,
            shortcut: 'e'
          },
          placeholder: {
            usage: 'Use process.env.IOPIPE_TOKEN as a placeholder variable to allow the token to be configured via environment variables in Serverless, AWS CLI, or AWS Console',
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
  run() {
    this.sls.cli.log('Wrapping your functions with IO|...');
    this.setOptions();
    this.checkForLib();
    this.checkToken();
    this.getFuncs();
    this.transform();
    this.operate();
  }
  setOptions(opts) {
    const custom = _lodash2.default.chain(this.sls).get('service.custom').pickBy((val, key) => key.match(/^iopipe/)).mapKeys((val, key) => _lodash2.default.camelCase(key.replace(/^iopipe/, ''))).mapValues((val, key) => {
      if (key === 'exclude' && _lodash2.default.isString(val)) {
        return val.split(',');
      }
      return val;
    }).value();
    (0, _options2.default)(_lodash2.default.defaults(opts, custom));
  }
  checkForLib() {
    const prefix = process.env.npm_config_prefix;
    if (prefix) {
      const { dependencies = {} } = JSON.parse(_fsExtra2.default.readFileSync((0, _path.join)(prefix, 'package.json')));
      if (!dependencies.iopipe) {
        if ((0, _options2.default)().noVerify) {
          return this.sls.cli.log('Skipping iopipe module installation check.');
        }
        throw new Error('IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.');
      }
    }
    return true;
  }
  checkToken() {
    const token = (0, _options2.default)().token;
    if (!token) {
      throw new Error('No iopipe token found. Specify in the "custom" object in serverless.yml or use the --token flag.');
    }
  }
  getFuncs() {
    try {
      const { servicePath } = this.sls.config;
      funcs = _lodash2.default.chain(this.sls.service.functions).omit((0, _options2.default)().exclude).values().map(obj => {
        const handlerArr = _lodash2.default.isString(obj.handler) ? obj.handler.split('.') : [];
        const fileName = handlerArr.slice(0, -1).join('.');
        const path = `${servicePath}/${fileName}.js`;
        return _lodash2.default.assign({}, obj, {
          method: _lodash2.default.last(handlerArr),
          path,
          code: _fsExtra2.default.readFileSync(path, 'utf8')
        });
      }).value();
    } catch (err) {
      console.error('Failed to require functions.');
      throw new Error(err);
    }
  }
  transform() {
    if (_lodash2.default.isArray(funcs) && funcs.length) {
      funcs = funcs.map(f => (0, _transform2.default)(f, this.sls));
      return true;
    }
    throw new Error('No functions to wrap iopipe with.');
  }
  operate() {
    funcs.forEach(f => {
      _fsExtra2.default.writeFileSync(`${f.path}.original.js`, f.code);
      _fsExtra2.default.writeFileSync(f.path, f.transformed);
    });
  }
  finish() {
    this.sls.cli.log('Successfully wrapped functions with IOpipe, cleaning up.');
    funcs.forEach(f => {
      _fsExtra2.default.writeFileSync(f.path, f.code);
      _fsExtra2.default.removeSync(`${f.path}.original.js`);
    });
  }
}

module.exports = ServerlessIOpipePlugin;