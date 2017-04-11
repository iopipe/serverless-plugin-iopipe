import _ from 'lodash';
import j from 'jscodeshift';

import options from './options';

function hasIOpipe(code){
  const size = j(code)
    .find(j.CallExpression, {
      callee: {
        name: 'require'
      },
      arguments: [
        {
          type: 'Literal',
          value: 'iopipe'
        }
      ]
    })
    .size();
  return size > 0;
}

function wrap(node){
  const token = options().placeholder ? 'process.env.IOPIPE_TOKEN' : `'${options().token}'`;
  const str = `require('iopipe')({clientId: ${token}})(REPLACE)`;
  return j(str)
    .find(j.Identifier, {
      name: 'REPLACE'
    })
    .replaceWith(node.right)
    .toSource({quote: options().quote});
}

function findModulePattern(method){
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

function findExportsPattern(method){
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

function findWrapSite(code, method){
  const first = j(code).find(j.AssignmentExpression, findModulePattern(method));
  if (first.size()){
    return first;
  }
  return j(code).find(j.AssignmentExpression, findExportsPattern(method));
}

export default function transform(obj = {}, sls){
  const {code, method} = obj;
  if (hasIOpipe(code)){
    sls.cli.log(`Found a reference to IOpipe already for ${obj.name}, skipping.`);
    return _.assign({}, obj, {transformed: obj.code});
  }
  const transformed = findWrapSite(code, method)
    .forEach(p => {
      p.node.right = wrap(p.node);
    })
    .toSource({quote: options().quote});
  return _.assign({}, obj, {transformed});
}
