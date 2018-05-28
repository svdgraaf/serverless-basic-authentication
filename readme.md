Serverless Basic Authentication (http basic auth)
--------------------------------------------

Sometimes you need to integrate your api with some outside system, and you are not capable of setting up custom headers with keys. Almost all systems support Basic Authentication out of the box though. Which is where this plugin comes in.

This plugin will install a custom authenticator for the functions you specify as being private, and use the API Keys (so no user management required) as http basic username and password.

Installation
------------
`npm install serverless-basic-authentication`

Add the plugin to your settings:

```
plugins:
  - serverless-basic-authentication
```

Usage
-----

Add some keys to your service:

```
provider:
  name: aws
  ...
  apiKeys:
    - foobar
    - platypus
```

For each function which is marked as `private: true`, the custom authenticator will be inserted, like so:

```
functions:
  foobar:
    handler: handler.foobar
    events:
      - http:
          path: foo/bar
          method: get
          private: true
```

After deploying, you can call the endpoint with a basic auth username/password:

```
curl -u [key-name]:[key-value] https://abckudzdef.execute-api.eu-west-1.amazonaws.com/dev/foo/bar
"yay"
```

How does this work?
-------------------
In Api Gateway, the custom authorizer function can also be used to supply the api key for a request. In this case, we lookup the api key on the fly through the api-gateway api, and check if the key matches. If so, we tell Api Gateway to use that key for handling the calls.

PR's are appreciated!
