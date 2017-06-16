const fs = require('fs-extra');
const path = require('path');

const distFolder = path.resolve(__dirname, '../');
const newFolder = path.resolve(
  __dirname,
  '../../example/.serverless_plugins/serverless-plugin-iopipe'
);

//only copy the dist folder if needed for local development
if (process.env.LOCAL_PLUGIN) {
  fs.copySync(distFolder, newFolder);
}
