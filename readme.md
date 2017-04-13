# IOpipe Serverless Framework Plugin (Alpha)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

A [serverless](http://www.serverless.com) plugin to automatically wrap your functions with [iopipe](https://iopipe.com).

# Requirements
The [iopipe](https://github.com/iopipe/iopipe)

# Install
With [yarn](https://yarnpkg.com) (recommended):
```
yarn add iopipe
yarn add serverless-plugin-iopipe --save-dev
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

Add your IOpipe project token within the "custom" config in `serverless.yml`
```yaml
custom:
  iopipeToken: YOUR_TOKEN HERE
```

# How Does it Work?
`serverless-plugin-iopipe` wraps the handlers defined in `serverless.yml` with IOpipe so you don't have to. It allows you to deploy and upgrade multiple functions simultaneously.

It's powered by the the excellent [jscodeshift](https://github.com/facebook/jscodeshift). The plugin examines each handler and modifies the code only within the deployment package if it needs to.

# Options
All options are set [in the "custom" config](https://serverless.com/framework/docs/providers/aws/guide/plugins#installing-plugins) in `serverless.yml`

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

```yaml
iopipeExclude: myExcludedHandler,alphaLambdaHandler
```

## Known Issues
- This plugin attempts to skip handlers that are already wrapped, but edge cases my arise, especially if you `require` the iopipe module outside of the handler file.
- If attempting to use es6 modules natively i.e. `export function handler...`, may not work.

## Support
File an issue here, hit us up [on Slack](https://iopipe.now.sh/), or send us a note at [support@iopipe.com](mailto:support@iopipe.com)
