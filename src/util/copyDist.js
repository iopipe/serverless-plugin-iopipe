import fs from 'fs-extra';
import path from 'path';

const distFolder = path.resolve(__dirname, '../');
const newFolder = path.resolve(__dirname, '../../example/.serverless_plugins/serverless-plugin-iopipe');

fs.copySync(distFolder, newFolder);
