import _ from 'lodash';
let options = {};

export default function(obj = options){
  options = _.chain(obj)
    .defaults({
      quote: 'single'
    })
    .mapKeys((val, key) => _.camelCase(key))
    .value();
  return options;
}
