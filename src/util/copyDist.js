import fs from 'fs-extra';
import {resolve} from 'path';

const distFolder = resolve(__dirname, '../');
const newFolder = resolve(__dirname, '../../example/.serverless_plugins/serverless-plugin-iopipe');

fs.copySync(distFolder, newFolder);
