# IOpipe Serverless Framework Plugin (Alpha)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

A [serverless](http://www.serverless.com) plugin to automatically wrap your functions with [iopipe](https://iopipe.com).

# Install
With npm:
```
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

## Known Issues
If attempting to use es6 modules natively i.e. `export function handler...`, may not work.
