'use strict'
const fs = require('fs');


class SetupBasicAuthentication {
  constructor (serverless, options) {
    this.consoleLog = serverless.cli.consoleLog;
    this.hooks = {
      'before:package:initialize': function () {
        // add the basic authenticator function
        injectBasicAuthFunction(serverless);

        // add our custom authenticator
        addAuthFileToPackage(serverless);
      },
      'after:package:finalize': function () {
        // remove the custom authenticator
        removeFileFromPackage(serverless)
      },
      'before:deploy:deploy': function() {
        // configure api gateway to check for the right place for the key
        configureApiGatewayKeySource(serverless);
      }
    }
  }
}

function removeFileFromPackage(serverless) {
  this.consoleLog('Removing Symlink for Basic Authenticator');
  fs.unlinkSync(serverless.config.servicePath + "/auth.py")
}

function addAuthFileToPackage(serverless) {
  if(!serverless.package) {
    serverless.package = {}
  }
  if(!serverless.package.include) {
    serverless.package.include = []
  }

  this.consoleLog('Adding Symlink for Basic Authenticator');
  // @TODO: Make target filename randomized with something, to prevent overriding
  // any files

  // append our auth.py file to the package
  serverless.package.include.push(__dirname + "/auth.py")
  fs.symlinkSync(__dirname + "/auth.py", serverless.config.servicePath + "/auth.py")
}

function injectBasicAuthFunction (serverless) {
  var basicAuthenticator = {
    handler: 'auth.basicAuth',
    runtime: 'python3.6'
  }

  // add the basic authenticator function
  serverless.service.functions['basicAuthenticator'] = basicAuthenticator;

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
        fnctn.events[fnctn_event].http.private == true &&
        fnctn.events[fnctn_event].http.authorizer == null
      ) {
        fnctn.events[fnctn_event].http.authorizer = 'basicAuthenticator'
        this.consoleLog(yellow('Basic Authentication') + ' enabled for ' + function_name);
      }
    }
  }
}

function configureApiGatewayKeySource(serverless) {
  var template = serverless.service.provider.compiledCloudFormationTemplate;
  if(template.Resources.ApiGatewayRestApi != null) {
    this.consoleLog('Configuring Api Gateway for Basic Authenticator')
    template.Resources.ApiGatewayRestApi.Properties.ApiKeySourceType = 'AUTHORIZER'
  }
}

// now we need to make our plugin object available to the framework to execute
module.exports = SetupBasicAuthentication
