'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (obj = options) {
  options = _lodash2.default.chain(obj).defaults({
    quote: 'single'
  }).mapKeys((val, key) => _lodash2.default.camelCase(key)).value();
  return options;
};

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let options = {};