import fs from 'fs-extra';
import {resolve} from 'path';

const distFolder = resolve(__dirname, '../');
const newFolder = resolve(__dirname, '../../example/.serverless_plugins/serverless-plugin-iopipe');

//only copy the dist folder if needed for local development
if (process.env.LOCAL_PLUGIN){
  fs.copySync(distFolder, newFolder);
}
