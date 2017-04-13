import _ from 'lodash';
// import fs from 'fs';
// import path from 'path';

import ServerlessPlugin from './index';
import sls from './__mocks__/sls';
import optionsModule from './options';

let Plugin = undefined;
let options = optionsModule();

test('Options module is a function', () => {
  expect(optionsModule).toBeInstanceOf(Function);
});

test('Options are set with defaults', () => {
  expect(options).toBeDefined();
  expect(options).toHaveProperty('quote');
  expect(options.noVerify).toBeUndefined();
});

test('Can instantiate main class', () => {
  Plugin = new ServerlessPlugin(sls);
  expect(Plugin).toBeDefined();
});

test('Plugin has props', () => {
  ['sls', 'package', 'funcs', 'commands', 'hooks'].forEach(str => {
    expect(Plugin).toHaveProperty(str);
  });
});

test('Plugin has methods', () => {
  ['log', 'run', 'setPackage'].forEach(str => {
    expect(Plugin[str]).toBeDefined();
  });
});

test('Options are set via Plugin', () => {
  options = optionsModule();
  expect(options).toBeInstanceOf(Object);
  expect(options).toHaveProperty('noVerify');
});

test('Options can be overridden', () => {
  expect(options.token).toEqual('SAMPLE_TOKEN_FOO');
  expect(options.exclude).toContain('excluded');
  options = optionsModule({token: 'WOW_FUN_TOKEN'});
  expect(options.token).toEqual('WOW_FUN_TOKEN');
  expect(options.exclude).toContain('excluded');
});

// test('Can instantiate main class', () => {
//   const Plugin = new ServerlessPlugin(sls);
// });
