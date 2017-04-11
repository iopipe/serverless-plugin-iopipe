'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {
  var obj = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : options;

  options = _lodash2.default.chain(obj).defaults({
    quote: 'single'
  }).mapKeys(function (val, key) {
    return _lodash2.default.camelCase(key);
  }).value();
  return options;
};

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var options = {};