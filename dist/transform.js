'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = transform;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _jscodeshift = require('jscodeshift');

var _jscodeshift2 = _interopRequireDefault(_jscodeshift);

var _options = require('./options');

var _options2 = _interopRequireDefault(_options);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function hasIOpipe(code) {
  var size = (0, _jscodeshift2.default)(code).find(_jscodeshift2.default.CallExpression, {
    callee: {
      name: 'require'
    },
    arguments: [{
      type: 'Literal',
      value: 'iopipe'
    }]
  }).size();
  return size > 0;
}

function wrap(node) {
  var token = (0, _options2.default)().placeholder ? 'process.env.IOPIPE_TOKEN' : '\'' + (0, _options2.default)().token + '\'';
  var str = 'require(\'iopipe\')({clientId: ' + token + '})(REPLACE)';
  return (0, _jscodeshift2.default)(str).find(_jscodeshift2.default.Identifier, {
    name: 'REPLACE'
  }).replaceWith(node.right).toSource({ quote: (0, _options2.default)().quote });
}

function findHandlerExpression(method) {
  return {
    left: {
      type: 'MemberExpression',
      object: {
        object: {
          type: 'Identifier',
          name: 'module'
        },
        property: {
          type: 'Identifier',
          name: 'exports'
        }
      },
      property: {
        type: 'Identifier',
        name: method
      }
    }
  };
}

function transform() {
  var obj = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var sls = arguments[1];
  var code = obj.code,
      method = obj.method;

  if (hasIOpipe(code)) {
    sls.cli.log('Found a reference to IOpipe already for ' + obj.name + ', skipping.');
    return _lodash2.default.assign({}, obj, { transformed: obj.code });
  }
  var transformed = (0, _jscodeshift2.default)(code).find(_jscodeshift2.default.AssignmentExpression, findHandlerExpression(method)).forEach(function (p) {
    p.node.right = wrap(p.node);
  }).toSource({ quote: (0, _options2.default)().quote });
  return _lodash2.default.assign({}, obj, { transformed: transformed });
}