import ua from 'universal-analytics';
import fs from 'fs-extra';
import _ from 'lodash';
import {join} from 'path';
import uuid from 'uuid';
import {createHash} from 'crypto';
import {default as debugLib} from 'debug';

import options from '../options';

let userId = undefined;
let visitor = undefined;

const debug = debugLib('serverless-plugin-iopipe:track');

export function set(instance){
  // create consistent, yet anonymized id for usage stats
  const pkg = fs.readJsonSync(join(instance.prefix, 'package.json'));
  const str = pkg.author || _.get(pkg, 'repository.url') || pkg.name || pkg.homepage || uuid.v4();
  userId = createHash('md5').update(str).digest('hex');
  visitor = ua('UA-73165042-2', userId, {
    strictCidFormat: false,
    https: true
  });
}

export function track(obj = {}){
  if (!visitor){
    return Promise.resolve('no-visitor');
  }
  if (options().noStats){
    return Promise.resolve('no-stats');
  }
  const {
    category = 'event',
    action = 'action',
    label = 'label',
    value
  } = obj;
  const newLabel = _.isString(label) ? label : JSON.stringify(label);
  debug(`Tracking ${category}: ${action}`);
  return new Promise((resolve, reject) => {
    visitor.event(category, action, newLabel, value, (err, res) => {
      return err ? reject(err) : resolve(res);
    });
  });
}
