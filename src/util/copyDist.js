const fs = require('fs-extra');
const path = require('path');

const distFolder = path.resolve(__dirname, '../../dist');
const newFolder = path.resolve(
  __dirname,
  '../../testProject/.serverless_plugins/serverless-plugin-iopipe'
);

fs.copySync(distFolder, newFolder);
