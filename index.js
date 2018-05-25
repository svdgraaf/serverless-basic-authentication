'use strict'
const fs = require('fs');


class SetBasicAuthEssentials {
  constructor (serverless, options) {
    this.hooks = {
      'before:package:initialize': function () {
        injectBasicAuthFunction(serverless);
        addAuthFileToPackage(serverless);
      },
      'after:package:finalize': function () { removeFileFromPackage(serverless) },
      'before:deploy:deploy': function() {
        configureApiGatewayKeySource(serverless);
      }
    }
  }
}

function removeFileFromPackage(serverless) {
  console.log('removing symlink')
  fs.unlinkSync(serverless.config.servicePath + "/auth.py")
}

function addAuthFileToPackage(serverless) {
  if(!serverless.package) {
    serverless.package = {}
  }
  if(!serverless.package.include) {
    serverless.package.include = []
  }

  console.log('adding symlink')
  // @TODO: Make target filename randomized with something, to prevent overriding
  // any files

  // append our auth.py file to the package
  serverless.package.include.push(__dirname + "/auth.py")
  fs.symlinkSync(__dirname + "/auth.py", serverless.config.servicePath + "/auth.py")
  console.log(serverless.package.include)
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
      }
    }
  }
}

function configureApiGatewayKeySource(serverless) {
  var template = serverless.service.provider.compiledCloudFormationTemplate;
  if(template.Resources.ApiGatewayRestApi != null) {
    console.log('Setting Api Gateway to fetch api keys from authorizer')
    template.Resources.ApiGatewayRestApi.Properties.ApiKeySourceType = 'AUTHORIZER'
  }
}

// now we need to make our plugin object available to the framework to execute
module.exports = SetBasicAuthEssentials
