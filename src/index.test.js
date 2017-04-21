import _ from 'lodash';
import {copySync, renameSync, removeSync, readdirSync, readFileSync, ensureDirSync} from 'fs-extra';
import path from 'path';

import ServerlessPlugin from './index';
import sls from './__mocks__/sls';
import options from './options';
import {visitor, track} from 'util/track';

let Plugin = undefined;
let opts = options();
const prefix = path.resolve(__dirname, '../example');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

test('Options module is a function', () => {
  expect(options).toBeInstanceOf(Function);
});

test('Options are set with defaults', () => {
  expect(opts).toBeDefined();
  expect(opts).toHaveProperty('quote');
  expect(opts.noVerify).toBeUndefined();
});

test('Track visitor is undefined', () => {
  expect(visitor).toBeUndefined();
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

test('Track visitor is set', () => {
  expect(visitor).toBeDefined();
  expect(visitor.event).toBeInstanceOf(Function);
});

test('Tracking works', async () => {
  const res = await track({action: 'dummy-test-action'});
  expect(res).toEqual(1);
});

test('Tracking noops when noStats is set', async () => {
  opts = options({noStats: true});
  const res = await track({action: 'dummy-test-action'});
  expect(res).toEqual('no-stats');
});

test('Package is set via Plugin', () => {
  expect(Plugin.package).toBeDefined();
  expect(Plugin.package.dependencies).not.toBeDefined();
  Plugin.setPackage();
  expect(Plugin.package.dependencies).toBeDefined();
});

test('Throws err when plugin is installed locally', () => {
  let targetErr = undefined;
  const folderPath = path.resolve(prefix, 'node_modules/serverless-plugin-iopipe');
  ensureDirSync(folderPath);
  try {
    Plugin.checkForLocalPlugin();
  } catch (err){
    targetErr = err;
  }
  expect(targetErr).toBeDefined();
  expect(targetErr).toBeInstanceOf(Error);
  opts = options({preferLocal: true});
  const result = Plugin.checkForLocalPlugin();
  expect(result).toBe('found-prefer-local');
  removeSync(folderPath);
  const notFound = Plugin.checkForLocalPlugin();
  expect(notFound).toBe('not-found');
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
    Plugin.checkForLib({dependencies: {lodash: '4.17.4'}});
  } catch (err){
    targetErr = err;
  }
  expect(targetErr).toBeInstanceOf(Error);
  expect(targetErr.message).toMatch(/module not found/);
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

test('Uses npm if no yarn.lock (no upgrade needed)', async () => {
  renameSync(path.resolve(prefix, 'yarn.lock'), path.resolve(prefix, 'yarn1.lock'));
  const upgradeResult = await Plugin.upgradeLib();
  expect(upgradeResult).toBe('success-no-upgrade-npm');
  renameSync(path.resolve(prefix, 'yarn1.lock'), path.resolve(prefix, 'yarn.lock'));
});

test('Uses yarn if available lockfile found (no upgrade needed)', async () => {
  const upgradeResult = await Plugin.upgradeLib();
  expect(upgradeResult).toBe('success-no-upgrade-yarn');
});

async function upgrade(manager){
  let err = undefined;
  try {
    //prepare dummy new package.json
    copySync(path.join(prefix, 'package.json'), path.join(prefix, 'packageOld.json'));
    manager === 'npm' && renameSync(path.join(prefix, 'yarn.lock'), path.join(prefix, 'yarn1.lock'));
    const upgradeResult = await Plugin.upgradeLib('0.2.1', 'cd example');
    expect(upgradeResult).toBe(`success-upgrade-${manager}-0.2.1`);
    //reset back to original
  } catch (e){
    err = e;
  }
  removeSync(path.join(prefix, 'package.json'));
  renameSync(path.join(prefix, 'packageOld.json'), path.join(prefix, 'package.json'));
  manager === 'npm' && renameSync(path.join(prefix, 'yarn1.lock'), path.join(prefix, 'yarn.lock'));
  if (err){
    throw new Error(err);
  }
  return manager;
}

test('Upgrades lib with yarn', async () => {
  const test = await upgrade('yarn');
  expect(test).toBe('yarn');
});

test('Upgrades lib with npm', async () => {
  const test = await upgrade('npm');
  expect(test).toBe('npm');
});

test('Gets funcs', () => {
  expect(Plugin.funcs).toEqual(expect.arrayContaining([]));
  expect(sls.service.functions.python.runtime).toEqual('python2.7');
  Plugin.getFuncs();
  expect(_.find(Plugin.funcs, f => f.name === 'python')).toBeUndefined();
  const simple = _.find(Plugin.funcs, f => f.name === 'simple');
  expect(simple).toBeDefined();
  ['handler', 'name', 'method', 'path', 'relativePath'].forEach(str => {
    expect(simple).toHaveProperty(str);
  });
  expect(simple.code).toMatchSnapshot();
});

test('Can setup .iopipe folder', async () => {
  await Plugin.setupFolder();
  const files = readdirSync(path.join(prefix, '.iopipe'));
  const req = ['.serverless', 'handlers', 'package.json'];
  expect(_.intersection(files, req)).toEqual(expect.arrayContaining(req));
});

test('Transforms from plugin', async () => {
  Plugin.transform();
  const first = _.head(Plugin.funcs);
  ['handler', 'name', 'method', 'path', 'relativePath'].forEach(str => {
    expect(first).toHaveProperty(str);
  });
  expect(first.transformed).toMatchSnapshot();
});

test('Saves transformed files to .iopipe folder', async () => {
  Plugin.operate();
  const file = readFileSync(path.join(prefix, '.iopipe', 'handlers/simple.js'), 'utf8');
  expect(file).toMatchSnapshot();
});

test('Cleans up', async () => {
  Plugin.finish();
  const files = readdirSync(prefix);
  expect(_.includes(files, '.iopipe')).toBeFalsy();
  expect(_.includes(files, 'serverless.yml')).toBeTruthy();
});
