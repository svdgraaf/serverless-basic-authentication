const fs = require('fs');
const chalk = require('chalk');
const path = require('path');

module.exports = class SetupBasicAuthentication {
  constructor(serverless, options) {
    this.options = options;
    this.serverless = serverless;

    // add the basic authentication function to the functions as soon as possible
    this.injectBasicAuthFunction(serverless);

    this.hooks = {
      'before:package:initialize': this.addAuthorizer.bind(this),
      'after:package:createDeploymentArtifacts': this.removeAuthorizer.bind(this),
      'before:deploy:deploy': this.configureApiGatewayKeySource.bind(this),
    };
  }

  addAuthorizer() {
    // add our custom authenticator
    this.addAuthFileToPackage();

    this.addAuthorizerFunctionToPrivateFunctions();
  }

  removeAuthorizer() {
    this.serverless.cli.consoleLog(`Basic Authentication: ${chalk.yellow('Removing Symlink for Basic Authenticator')}`);
    fs.unlinkSync(path.normalize(`${this.serverless.config.servicePath}/basic_auth.py`));
  }

  addAuthFileToPackage() {
    if (!this.serverless.package) {
      this.serverless.package = {};
    }

    if (!this.serverless.package.include) {
      this.serverless.package.include = [];
    }

    this.serverless.cli.consoleLog(`Basic Authentication: ${chalk.yellow('Adding Symlink for Basic Authenticator')}`);
    // @TODO: Make target filename randomized with something, to prevent overriding
    // any files

    // append our basic_auth.py file to the package
    this.serverless.package.include.push(path.normalize(`${__dirname}/basic_auth.py`));
    try {
      fs.symlinkSync(
        path.normalize(`${__dirname}/basic_auth.py`),
        path.normalize(`${this.serverless.config.servicePath}/basic_auth.py`)
      );
    } catch (error) {
      if (error.errno === -4048 && error.code === 'EPERM') {
        fs.copyFileSync(
          path.normalize(`${__dirname}/basic_auth.py`),
          path.normalize(`${this.serverless.config.servicePath}/basic_auth.py`)
        );
      } else {
        throw error;
      }
    }
  }

  injectBasicAuthFunction() {
    this.serverless.cli.consoleLog(`Basic Authentication: ${chalk.yellow('Adding function for Basic Authenticator')}`);
    const basicAuthenticator = {
      handler: 'basic_auth.basicAuth',
      runtime: 'python3.6',
    };

    // add the basic authenticator function
    this.serverless.service.functions.basicAuthenticator = basicAuthenticator;
  }

  addAuthorizerFunctionToPrivateFunctions() {
    // For each function which is marked as 'private', set the basic authenticator
    // if it doesn't have a custom authenticator yet.

    // If any of the functions' events is marked with the flag "basicAuth", then
    // only the events with basicAuth=true are configured with basic auth.

    const functions = this.serverless.service.functions || [];

    const hasAnyBasicAuthConfig = Object.keys(functions).reduce(
      (result, func) => result || Object.keys(func.events || []).reduce(
        (hasBasicAuthConfig, event) => hasBasicAuthConfig || (event.http && 'basicAuth' in event.http),
      false),
    false);

    Object.keys(functions).forEach((functionName) => {
      // ignore our own function
      if (functionName === 'basicAuthenticator') {
        return;
      }

      // get all function configs
      const fnctn = functions[functionName];

      // check if any of the http events is marked as private, and if that event
      // also doesn't have a custom authorizer already, apply our authenticator
      Object.keys(fnctn.events).forEach((fnctnEvent) => {
        // if http doesn't exist, skip
        if (!fnctn.events[fnctnEvent].http) {
          return;
        }

        if (
          !fnctn.events[fnctnEvent].http.authorizer &&
          (
            fnctn.events[fnctnEvent].http.private === true ||
            !hasAnyBasicAuthConfig ||
            fnctn.events[fnctnEvent].http.basicAuth === true
          )
        ) {
          fnctn.events[fnctnEvent].http.authorizer = {
            name: 'basicAuthenticator',
            identitySource: '', // this is only valid if we set cache ttl to 0
            resultTtlInSeconds: 0,
            type: 'REQUEST',
          };
          this.serverless.cli.consoleLog(`Basic Authentication: ${chalk.yellow(`Enabled for ${functionName}`)}`);
        }
      });
    });
  }

  configureApiGatewayKeySource() {
    const template = this.serverless.service.provider.compiledCloudFormationTemplate;
    if (template.Resources.ApiGatewayRestApi != null) {
      this.serverless.cli.consoleLog(
        `Basic Authentication: ${chalk.yellow('Configuring Api Gateway for Basic Authenticator')}`,
      );
      template.Resources.ApiGatewayRestApi.Properties.ApiKeySourceType = 'AUTHORIZER';
    }
  }
};
