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
  const size = (0, _jscodeshift2.default)(code).find(_jscodeshift2.default.CallExpression, {
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
  const token = (0, _options2.default)().placeholder ? 'process.env.IOPIPE_TOKEN' : `'${(0, _options2.default)().token}'`;
  const str = `require('iopipe')({clientId: ${token}})(REPLACE)`;
  return (0, _jscodeshift2.default)(str).find(_jscodeshift2.default.Identifier, {
    name: 'REPLACE'
  }).replaceWith(node.right).toSource({ quote: (0, _options2.default)().quote });
}

function findModulePattern(method) {
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

function findExportsPattern(method) {
  return {
    left: {
      type: 'MemberExpression',
      object: {
        type: 'Identifier',
        name: 'exports'
      },
      property: {
        type: 'Identifier',
        name: method
      }
    }
  };
}

function findWrapSite(code, method) {
  const first = (0, _jscodeshift2.default)(code).find(_jscodeshift2.default.AssignmentExpression, findModulePattern(method));
  if (first.size()) {
    return first;
  }
  return (0, _jscodeshift2.default)(code).find(_jscodeshift2.default.AssignmentExpression, findExportsPattern(method));
}

function transform(obj = {}, sls) {
  const { code, method } = obj;
  if (hasIOpipe(code)) {
    sls.cli.log(`Found a reference to IOpipe already for ${obj.name}, skipping.`);
    return _lodash2.default.assign({}, obj, { transformed: obj.code });
  }
  const transformed = findWrapSite(code, method).forEach(p => {
    p.node.right = wrap(p.node);
  }).toSource({ quote: (0, _options2.default)().quote });
  return _lodash2.default.assign({}, obj, { transformed });
}