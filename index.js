'use strict'
const fs = require('fs');
const chalk = require('chalk');


class SetupBasicAuthentication {
  constructor (serverless, options) {

    // add the basic authentication function to the functions as soon as possible
    injectBasicAuthFunction(serverless);

    this.hooks = {
      'before:package:initialize': function () {
        // add our custom authenticator
        addAuthFileToPackage(serverless);

        addAuthorizerFunctionToPrivateFunctions(serverless);
      },
      'after:package:createDeploymentArtifacts': function () {
        // remove the custom authenticator
        removeFileFromPackage(serverless)
      },
      'before:deploy:deploy': function() {
        // // add the basic authenticator function
        // injectBasicAuthFunction(serverless);

        // configure api gateway to check for the right place for the key
        configureApiGatewayKeySource(serverless);
      }
    }
  }
}

function removeFileFromPackage(serverless) {
  serverless.cli.consoleLog('Basic Authentication: ' + chalk.yellow('Removing Symlink for Basic Authenticator'));
  fs.unlinkSync(serverless.config.servicePath + "/basic_auth.py")
}

function addAuthFileToPackage(serverless) {
  if(!serverless.package) {
    serverless.package = {}
  }
  if(!serverless.package.include) {
    serverless.package.include = []
  }

  serverless.cli.consoleLog('Basic Authentication: ' + chalk.yellow('Adding Symlink for Basic Authenticator'));
  // @TODO: Make target filename randomized with something, to prevent overriding
  // any files

  // append our auth.py file to the package
  serverless.package.include.push(__dirname + "/auth.py")
  fs.symlinkSync(__dirname + "/basic_auth.py", serverless.config.servicePath + "/basic_auth.py")
}

function injectBasicAuthFunction (serverless) {
  serverless.cli.consoleLog('Basic Authentication: ' + chalk.yellow('Adding function for Basic Authenticator'));
  var basicAuthenticator = {
    handler: 'basic_auth.basicAuth',
    runtime: 'python3.6'
  }

  // add the basic authenticator function
  serverless.service.functions.basicAuthenticator = basicAuthenticator;
}

function addAuthorizerFunctionToPrivateFunctions(serverless) {
  // for each function which is marked as 'private', set the basic authenticator
  // if it doesn't have a custom authenticator yet
  for(let function_name in serverless.service.functions) {

    // ignore our own function
    if(function_name == 'basicAuthenticator') {
      continue;
    }

    var fnctn = serverless.service.functions[function_name];

    // check if any of the http events is marked as private, and if that event
    // also doesn't have a custom authorizer already, apply our authenticator
    for(let fnctn_event in fnctn['events']) {
      if(
        serverless.service.functions[function_name].events[fnctn_event].http.private == true &&
        serverless.service.functions[function_name].events[fnctn_event].http.authorizer == null
      ) {
        serverless.service.functions[function_name].events[fnctn_event].http.authorizer = 'basicAuthenticator'
        serverless.cli.consoleLog('Basic Authentication: ' + chalk.yellow('Enabled for ' + function_name));
      }
    }
  }
}

function configureApiGatewayKeySource(serverless) {
  var template = serverless.service.provider.compiledCloudFormationTemplate;
  if(template.Resources.ApiGatewayRestApi != null) {
    serverless.cli.consoleLog('Basic Authentication: ' + chalk.yellow('Configuring Api Gateway for Basic Authenticator'));
    template.Resources.ApiGatewayRestApi.Properties.ApiKeySourceType = 'AUTHORIZER'
  }
}

// now we need to make our plugin object available to the framework to execute
module.exports = SetupBasicAuthentication
