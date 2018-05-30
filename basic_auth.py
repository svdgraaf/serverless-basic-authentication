import base64
import json
import re
import boto3


def basicAuth(event, context):
    authorizationToken = event['authorizationToken']
    b64_token = authorizationToken.split(' ')[-1]

    # decode the base64 encoded header value
    username, token = base64.b64decode(b64_token).decode("utf-8").split(':')

    # search for the given api key
    client = boto3.client('apigateway')
    response = client.get_api_keys(nameQuery=username, includeValues=True)

    # if no keys found, deny access
    if len(response['items']) != 1:
        print("Couldn't find key")
        raise Exception('Unauthorized!')

    # if the key value does not match, deny access
    if response['items'][0]['value'] != token:
        print("Key value mismatch")
        raise Exception('Unauthorized!!')

    # All is well, return a policy which allows this user to access
    # this specific call
    authResponse = {
        'principalId': username,
        'usageIdentifierKey': token,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': 'Allow',
                'Resource': event['methodArn']
            }]
        }
    }

    return authResponse
