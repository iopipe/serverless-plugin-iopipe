'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _transform2 = require('./transform');

var _transform3 = _interopRequireDefault(_transform2);

var _options = require('./options');

var _options2 = _interopRequireDefault(_options);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var funcs = [];

var ServerlessIOpipePlugin = function () {
  function ServerlessIOpipePlugin(sls, opts) {
    (0, _classCallCheck3.default)(this, ServerlessIOpipePlugin);

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

  (0, _createClass3.default)(ServerlessIOpipePlugin, [{
    key: 'run',
    value: function run() {
      this.sls.cli.log('Wrapping your functions with IO|...');
      this.setOptions();
      this.checkForLib();
      this.checkToken();
      this.getFuncs();
      this.transform();
      this.operate();
    }
  }, {
    key: 'setOptions',
    value: function setOptions(opts) {
      var custom = _lodash2.default.chain(this.sls).get('service.custom').pickBy(function (val, key) {
        return key.match(/^iopipe/);
      }).mapKeys(function (val, key) {
        return _lodash2.default.camelCase(key.replace(/^iopipe/, ''));
      }).mapValues(function (val, key) {
        if (key === 'exclude' && _lodash2.default.isString(val)) {
          return val.split(',');
        }
        return val;
      }).value();
      (0, _options2.default)(_lodash2.default.defaults(opts, custom));
    }
  }, {
    key: 'checkForLib',
    value: function checkForLib() {
      var prefix = process.env.npm_config_prefix;
      if (prefix) {
        var _JSON$parse = JSON.parse(_fsExtra2.default.readFileSync((0, _path.join)(prefix, 'package.json'))),
            _JSON$parse$dependenc = _JSON$parse.dependencies,
            dependencies = _JSON$parse$dependenc === undefined ? {} : _JSON$parse$dependenc;

        if (!dependencies.iopipe) {
          if ((0, _options2.default)().noVerify) {
            return this.sls.cli.log('Skipping iopipe module installation check.');
          }
          throw new Error('IOpipe module not found in package.json. Make sure to install it via npm or yarn, or use the --noVerify option for serverless-plugin-iopipe.');
        }
      }
      return true;
    }
  }, {
    key: 'checkToken',
    value: function checkToken() {
      var token = (0, _options2.default)().token;
      if (!token) {
        throw new Error('No iopipe token found. Specify in the "custom" object in serverless.yml or use the --token flag.');
      }
    }
  }, {
    key: 'getFuncs',
    value: function getFuncs() {
      try {
        var servicePath = this.sls.config.servicePath;

        funcs = _lodash2.default.chain(this.sls.service.functions).omit((0, _options2.default)().exclude).values().map(function (obj) {
          var handlerArr = _lodash2.default.isString(obj.handler) ? obj.handler.split('.') : [];
          var fileName = handlerArr.slice(0, -1).join('.');
          var path = servicePath + '/' + fileName + '.js';
          return _lodash2.default.assign({}, obj, {
            method: _lodash2.default.last(handlerArr),
            path: path,
            code: _fsExtra2.default.readFileSync(path, 'utf8')
          });
        }).value();
      } catch (err) {
        console.error('Failed to require functions.');
        throw new Error(err);
      }
    }
  }, {
    key: 'transform',
    value: function transform() {
      var _this = this;

      if (_lodash2.default.isArray(funcs) && funcs.length) {
        funcs = funcs.map(function (f) {
          return (0, _transform3.default)(f, _this.sls);
        });
        return true;
      }
      throw new Error('No functions to wrap iopipe with.');
    }
  }, {
    key: 'operate',
    value: function operate() {
      funcs.forEach(function (f) {
        _fsExtra2.default.writeFileSync(f.path + '.original.js', f.code);
        _fsExtra2.default.writeFileSync(f.path, f.transformed);
      });
    }
  }, {
    key: 'finish',
    value: function finish() {
      this.sls.cli.log('Successfully wrapped functions with IOpipe, cleaning up.');
      funcs.forEach(function (f) {
        _fsExtra2.default.writeFileSync(f.path, f.code);
        _fsExtra2.default.removeSync(f.path + '.original.js');
      });
    }
  }]);
  return ServerlessIOpipePlugin;
}();

module.exports = ServerlessIOpipePlugin;