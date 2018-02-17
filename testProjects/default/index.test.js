import _ from 'lodash';
import AdmZip from 'adm-zip';

test('Generated file requires plugin and includes plugin inline', () => {
  const zip = new AdmZip('./.serverless/sls-unit-test-default.zip');
  expect(1).toBe(1);
  const handlerFile = _.find(
    zip.getEntries(),
    entry => entry.entryName === 'iopipe-handlers.js'
  );
  const fileContents = handlerFile.getData().toString('utf8');
  expect(fileContents).toMatchSnapshot();
});
