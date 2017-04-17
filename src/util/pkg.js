import path from 'path';
import R from 'ramda';

const handlerProp = R.prop('handler');

const handlerExport = R.compose(R.last, R.split('.'));

const handlerPath = handler => R.replace(handlerExport(handler), 'js', handler);
const handlerFile = R.compose(path.basename, handlerPath);
const fnPath = R.compose(handlerPath, handlerProp);
const fnFilename = R.compose(handlerFile, handlerProp);

const list = R.unapply(R.identity);

const setPackage = fn =>
  R.assoc(
    'package',
    R.objOf(
      'include',
      R.compose(list, fnFilename)(fn)
    ),
    fn
  );

const setHandler = R.over(R.lensProp('handler'), a => a);

const setPackageAndHandler = R.map(R.compose(setHandler, setPackage));

const setArtifacts = (serverlessPath, fns) => R.map(
  R.over(
    R.lensProp('artifact'),
    artifact => {
      return path.join(serverlessPath, path.basename(artifact));
    }
  ),
  fns
);

export {
  fnPath,
  fnFilename,
  setPackageAndHandler,
  setArtifacts
};
