import _ from 'lodash';
import AdmZip from 'adm-zip';

process.env.IOPIPE_TOKEN = 'test_token';
process.env.IOPIPE_DEBUG = true;

test('Generated file requires plugin and includes plugin inline', async () => {
  const zip = new AdmZip('./.serverless/sls-unit-test-default.zip');
  expect(1).toBe(1);
  const handlerFile = _.find(
    zip.getEntries(),
    entry => entry.entryName === 'iopipe-handlers.js'
  );
  const fileContents = handlerFile.getData().toString('utf8');
  expect(fileContents).toMatchSnapshot();
  /*eslint-disable no-eval*/
  eval(fileContents);
  const result = await new Promise(succeed => {
    exports.simple({}, { succeed });
  });
  expect(result.statusCode).toEqual(200);
  const syntaxErrorResult = await new Promise(succeed => {
    exports.syntaxError({}, {}, succeed);
  });
  console.log(syntaxErrorResult);
});
