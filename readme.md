# IOpipe Serverless Framework Plugin (Alpha)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

A [serverless](http://www.serverless.com) plugin to automatically wrap your functions with [iopipe](https://iopipe.com).

# Requirements
- Node >= `6.10`
- NPM >= `3.0`
- Yarn >= `0.22.0` (optional)
- A valid `package.json` file
- A valid `serverless.yml` file

# Install
With [yarn](https://yarnpkg.com) (recommended):
```
yarn add iopipe
yarn add serverless-plugin-iopipe --dev
```

With npm:
```
npm install iopipe
npm install serverless-plugin-iopipe --save-dev
```


Add the plugin to your `serverless.yml` file:
```yaml
plugins:
  - serverless-plugin-iopipe
```

Add your IOpipe project token within the "custom" config in `serverless.yml`. [Where is the token?](https://dashboard.iopipe.com/install)
```yaml
custom:
  iopipeToken: YOUR_TOKEN HERE
```

# How Does it Work?
`serverless-plugin-iopipe` wraps the function handlers defined in `serverless.yml` with IOpipe so you don't have to. It allows you to deploy and upgrade multiple functions simultaneously.

It's powered by the the excellent [jscodeshift](https://github.com/facebook/jscodeshift). The plugin examines each handler and modifies the code _only within the deployment package_ if it needs to.

# Options
All options are set [in the "custom" config](https://serverless.com/framework/docs/providers/aws/guide/plugins#installing-plugins) in `serverless.yml`. [See Example](https://github.com/iopipe/serverless-plugin-iopipe/blob/master/example/serverless.yml)

#### `iopipeToken` (required)

The token (clientId) of the project you would like to wrap your functions with.

#### `iopipeNoVerify` (optional)

Skip a check that ensures iopipe is installed via npm/yarn and present in package.json

#### `iopipeNoUpgrade` (optional)

The plugin automatically upgrades the IOpipe library to the most recent minor version. Use this option to disable that feature.

#### `iopipeNoYarn` (optional)

When auto-upgrading, Yarn will be used in place of NPM if a yarn.lock file is found. Use this flag disable yarn and use NPM to upgrade the iopipe library.

#### `iopipeExclude` (optional)

Exclude certain functions from the plugin. Comma separated string.

#### `iopipePlaceholder` (optional)

Use `process.env.IOPIPE_TOKEN` as a placeholder variable to allow the token to be configured via environment variables in Serverless, AWS CLI, or AWS Console instead of embedding the token string directly.

## Known Issues
- This plugin attempts to skip handlers that are already wrapped, but edge cases my arise, especially if you `require` the iopipe module outside of the handler file.
- If your `package.json` is located in a non-standard place, auto-upgrading may not work.
- If attempting to use es6 modules natively i.e. `export function handler...`, may not work.

## Support
File an issue here, hit us up [on Slack](https://iopipe.now.sh/), or send us a note at [support@iopipe.com](mailto:support@iopipe.com)
