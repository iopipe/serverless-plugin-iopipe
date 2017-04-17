import _ from 'lodash';
import fs from 'fs';
import path from 'path';

import ServerlessPlugin from './index';
import sls from './__mocks__/sls';
import options from './options';

let Plugin = undefined;
let opts = options();
const prefix = path.resolve(__dirname, '../example');

test('Options module is a function', () => {
  expect(options).toBeInstanceOf(Function);
});

test('Options are set with defaults', () => {
  expect(opts).toBeDefined();
  expect(opts).toHaveProperty('quote');
  expect(opts.noVerify).toBeUndefined();
});

test('Can instantiate main class', () => {
  Plugin = new ServerlessPlugin(sls, {
    prefix
  });
  expect(Plugin).toBeDefined();
});

test('Plugin has props', () => {
  ['sls', 'package', 'funcs', 'commands', 'hooks'].forEach(str => {
    expect(Plugin).toHaveProperty(str);
  });
});

test('Plugin has proper executeable methods', () => {
  ['log', 'run', 'setPackage', 'setOptions', 'checkForLib', 'upgradeLib', 'checkToken', 'getFuncs', 'transform', 'operate', 'finish'].forEach(str => {
    expect(Plugin[str]).toBeDefined();
    expect(Plugin[str]).toBeInstanceOf(Function);
  });
});

test('Options are set via Plugin', () => {
  opts = options();
  expect(opts).toBeInstanceOf(Object);
  expect(opts).toHaveProperty('noVerify');
});

test('Options can be overridden', () => {
  expect(opts.token).toEqual('SAMPLE_TOKEN_FOO');
  expect(opts.exclude).toContain('excluded');
  opts = options({token: 'WOW_FUN_TOKEN'});
  expect(opts.token).toEqual('WOW_FUN_TOKEN');
  expect(opts.exclude).toContain('excluded');
});

test('Package is set via Plugin', () => {
  expect(Plugin.package).toBeDefined();
  expect(Plugin.package.dependencies).not.toBeDefined();
  Plugin.setPackage();
  expect(Plugin.package.dependencies).toBeDefined();
});

test('Can check for lib, all is well', () => {
  const check = Plugin.checkForLib();
  expect(check).toBe(true);
});

test('Skips lib check if package.json has no dependencies', () => {
  const check = Plugin.checkForLib({});
  expect(check).toBe('no-package-skip');
});

test('Skips lib check if opts specify noVerify', () => {
  opts = options({noVerify: true});
  const check = Plugin.checkForLib({dependencies: {}});
  expect(check).toBe('no-verify-skip');
  opts = options({noVerify: false});
});

test('Throws error if iopipe is not found in valid package.json', () => {
  let targetErr = undefined;
  try {
    Plugin.checkForLib({dependencies: {lodash: '4.17.4'}})
  } catch (err){
    targetErr = err;
  }
  expect(targetErr).toBeInstanceOf(Error);
  expect(targetErr.message).toMatch(/module not found/)
});

test('Throws error if iopipe token is not found', () => {
  let targetErr = undefined;
  try {
    opts = options({token: ''});
    Plugin.checkToken();
  } catch (err){
    targetErr = err;
  }
  expect(targetErr).toBeInstanceOf(Error);
  expect(targetErr.message).toMatch(/iopipe token found/);
});

test('Uses npm if no yarn.lock', () => {
  fs.renameSync(path.resolve(prefix, 'yarn.lock'), path.resolve(prefix, 'yarn1.lock'));
  Plugin.upgradeLib();
  fs.renameSync(path.resolve(prefix, 'yarn1.lock'), path.resolve(prefix, 'yarn.lock'));
});

// test('Can instantiate main class', () => {
//   const Plugin = new ServerlessPlugin(sls);
// });
