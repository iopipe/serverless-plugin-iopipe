/*eslint-disable import/no-extraneous-dependencies*/
/*eslint-disable no-eval*/
import _ from 'lodash';
import AdmZip from 'adm-zip';

process.env.IOPIPE_TOKEN = 'test_token';

test('Generated files require plugin, include plugin inline, and export original handler', async () => {
  const zip = new AdmZip('./.serverless/sls-unit-test-default.zip');

  // simple handler
  const simpleFile = _.find(
    zip.getEntries(),
    entry => entry.entryName === 'simple-0-iopipe.js'
  );
  const simpleFileContents = simpleFile.getData().toString('utf8');
  expect(simpleFileContents).toMatchSnapshot();

  eval(simpleFileContents);
  const result = await new Promise(succeed => {
    exports.simple({}, { succeed });
  });
  expect(result.statusCode).toEqual(200);

  // name mismatch handler
  const nameMismatch = _.find(
    zip.getEntries(),
    entry => entry.entryName === 'nameMismatch-8-iopipe.js'
  );
  const nameMismatchContents = nameMismatch.getData().toString('utf8');
  expect(nameMismatchContents).toMatchSnapshot();

  eval(nameMismatchContents);
  const nameMismatchResult = await new Promise(succeed => {
    exports.nameMismatch({}, { succeed });
  });
  expect(nameMismatchResult).toEqual(301);

  // syntax error handler
  const syntaxErrorFile = _.find(
    zip.getEntries(),
    entry => entry.entryName === 'syntaxError-6-iopipe.js'
  );
  const syntaxErrorResultFileContents = syntaxErrorFile
    .getData()
    .toString('utf8');
  expect(syntaxErrorResultFileContents).toMatchSnapshot();
  eval(syntaxErrorResultFileContents);
  const syntaxErrorResult = await new Promise(succeed => {
    exports.syntaxError({}, {}, succeed);
  });
  expect(syntaxErrorResult.message).toMatch(/Unexpected\stoken,\s/);
});
