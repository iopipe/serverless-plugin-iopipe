# IOpipe Serverless Framework Plugin (Beta)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![CircleCI](https://circleci.com/gh/iopipe/serverless-plugin-iopipe/tree/master.svg?style=svg&circle-token=3787c8931aea4de4facb5fde25ae456f294f8cc1)](https://circleci.com/gh/iopipe/serverless-plugin-iopipe/tree/master)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

A [serverless](http://www.serverless.com) plugin to automatically wrap your functions with [iopipe](https://iopipe.com).

# Requirements
- Node >= `4.3.2`
- NPM >= `2.14.12`
- Serverless >= `1.13.0`
- Yarn >= `0.22.0` (optional)
- A valid `package.json` file
- A valid `serverless.yml` file

# Install
With [yarn](https://yarnpkg.com) (recommended) in project directory:
```
yarn add iopipe
yarn add serverless-plugin-iopipe --dev
```

With npm in project directory:
```
npm install iopipe
npm install serverless-plugin-iopipe --save-dev
```

Add the plugin to your `serverless.yml` file:
```yaml
plugins:
  - serverless-plugin-iopipe
```

Add your IOpipe project token within the "custom" config in `serverless.yml`. [Where is the token?](https://dashboard.iopipe.com/install) Alternatively, you can ensure that `$IOPIPE_TOKEN` is set in the lambda environment.
```yaml
custom:
  iopipeToken: YOUR_TOKEN_HERE
```

You're set! The plugin will run during an `sls deploy`.

Check out an [example here](https://github.com/iopipe/serverless-plugin-iopipe/blob/master/example/serverless.yml).

# How Does it Work?
`serverless-plugin-iopipe` outputs a file that imports and wraps the function handlers defined in `serverless.yml` with IOpipe so you don't have to. It allows you to deploy and upgrade multiple functions simultaneously.

# Options
All options are set [in the "custom" config](https://serverless.com/framework/docs/providers/aws/guide/plugins#installing-plugins) in `serverless.yml`. [See Example](https://github.com/iopipe/serverless-plugin-iopipe/blob/master/example/serverless.yml)

#### `iopipeToken` (required)

The token (clientId) of the project you would like to wrap your functions with. Falls back to `$IOPIPE_TOKEN` in the lambda environment.

#### `iopipeNoVerify` (optional)

Skip a check that ensures iopipe is installed via npm/yarn and present in package.json

#### `iopipeNoUpgrade` (optional)

The plugin automatically upgrades the IOpipe library to the latest available version that satisfies the semver range specified in package.json. Use this option to disable that feature.

#### `iopipeNoYarn` (optional)

When auto-upgrading, Yarn will be used in place of NPM if a yarn.lock file is found. Use this flag disable yarn and use NPM to upgrade the iopipe library.

#### `iopipeExclude` (optional)

Exclude certain functions from the plugin. Comma separated string.

#### `iopipePlaceholder` (optional)

Use `process.env.IOPIPE_TOKEN` as a placeholder variable to allow the token to be configured via environment variables in Serverless, AWS CLI, or AWS Console instead of embedding the token string directly.

#### `iopipeNoStats` (optional)

By default, the plugin sends _anonymized_, non-identifying usage statistics to Google Analytics. IOpipe will use this info to prioritize updates and enhancements to the plugin. If you'd like to opt out of this, just set this option.

## Known Issues
- This plugin attempts to skip handlers that are already wrapped, but edge cases my arise, especially if you `require` the iopipe module outside of the handler file.
- If your `package.json` is located in a non-standard place, auto-upgrading may not work.
- If attempting to use es6 modules natively i.e. `export function handler...`, may not work.

## Support
File an issue here, hit us up [on Slack](https://iopipe.now.sh/), or send us a note at [support@iopipe.com](mailto:support@iopipe.com)

## Contributing
- This project uses [Prettier](https://github.com/prettier/prettier). Please execute `npm run eslintFix` to auto-format the code before submitting pull requests.
