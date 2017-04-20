import _ from 'lodash';
import fs from 'fs';
import path from 'path';

import transform from './transform';

const files = _.chain(path.resolve(__dirname, '../example/handlers'))
  .thru(fs.readdirSync)
  .filter(str => str.match(/\.js/))
  .map(str => {
    return [
      str.replace(/\.js$/, ''),
      fs.readFileSync(path.resolve(__dirname, `../example/handlers/${str}`), 'utf8')
    ];
  })
  .fromPairs()
  .value();

test('es5.js transformed matches screenshot', () => {
  const next = transform({code: files.es5});
  expect(next.transformed).toMatchSnapshot();
});

test('es5 transformed code works', () => {
  const next = transform({code: files.es5});
  global.transformCodeResult = undefined;
  const preCode = `
    const require = function(str){
      return global[str];
    };
    global.finished = (err, result) => {
      global.transformCodeResult = err || result;
    }
    global.iopipe = (opts) => {
      return (fn) => {
        return (event, context) => {
          return fn(event, context, global.finished);
        }
      }
    };
  `;
  const afterCode = `
    module.exports.handler();
  `;
  const compiled = preCode + next.transformed + afterCode;
  /*eslint-disable no-eval*/
  eval(compiled);
  /*eslint-enable no-eval*/
  expect(global.transformCodeResult).toHaveProperty('statusCode');
  expect(global.transformCodeResult.statusCode).toEqual(200);
});

test('es5Named.js transformed matches screenshot', () => {
  const next = transform({code: files.es5Named});
  expect(next.transformed).toMatchSnapshot();
});

test('multiple.js transformed matches screenshot', () => {
  const next = transform({code: files.multiple});
  expect(next.transformed).toMatchSnapshot();
});

test('noModule.js transformed matches screenshot', () => {
  const next = transform({code: files.noModule});
  expect(next.transformed).toMatchSnapshot();
});

test('simple.js transformed matches screenshot', () => {
  const next = transform({code: files.simple});
  expect(next.transformed).toMatchSnapshot();
});


test('hasLib.js transformed matches screenshot', () => {
  const next = transform({code: files.hasLib});
  expect(next.transformed).toMatchSnapshot();
});

