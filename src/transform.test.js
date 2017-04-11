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
