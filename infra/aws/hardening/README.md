# AWS resilience probe

This AWS SAM stack creates one tightly capped, scale-to-zero resilience probe:

- one Lambda function using the supported Python 3.13 ARM runtime
- one Lambda Function URL with `AWS_IAM` authentication
- 128 MB memory and a five-second function timeout
- one deployment-time allowlist of at most five public HTTPS endpoints
- one dedicated CloudWatch log group with one-day retention
- one execution role that can only write to that log group

There is no schedule, public invocation permission, provisioned concurrency,
custom metric, database, API layer, VPC attachment, or other workload resource.
The function ignores all request input, never returns endpoint response bodies,
and follows redirects only to explicitly allowlisted hosts.

Lambda Function URLs have no endpoint charge. Lambda and CloudWatch Logs have
ongoing Free Tier allowances, but usage outside those allowances can still consume
credits or incur charges on a paid account. This stack's hard caps and lack of a
schedule keep its idle usage at zero; invoke it only when a resilience check is
needed. IAM-only access, the absence of any automatic trigger, and the account's
regional concurrency ceiling bound this deployment. The template intentionally
does not reserve function concurrency because this account's quota is 10 and AWS
requires all 10 executions to remain in the unreserved pool.

## Validate and deploy

Install the AWS SAM CLI, then run from this directory:

```sh
sam validate --lint
sam build
sam deploy --guided --capabilities CAPABILITY_IAM
```

Recommended deployment Region: `us-east-2`, alongside the site's existing AWS
resources. Review the two parameters during the guided deployment:

- `ProbeEndpoints`: one to five comma-separated HTTPS URLs without spaces.
- `ProbeAllowedHosts`: exact hostnames allowed for initial requests and redirects.

The defaults check the homepage and Episodes page on `theavalanchehour.com`,
while allowing the site's `www` redirect hostname.

## Grant invocation access

The stack outputs the Function URL and function ARN. The URL has `AWS_IAM`
authentication and no public resource policy. A same-account user or role needs
both current Function URL actions; the second statement prevents direct Lambda
invocation and permits only a Function URL request:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunctionUrl",
      "Resource": "RESILIENCE_PROBE_FUNCTION_ARN",
      "Condition": {
        "StringEquals": {
          "lambda:FunctionUrlAuthType": "AWS_IAM"
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "RESILIENCE_PROBE_FUNCTION_ARN",
      "Condition": {
        "Bool": {
          "lambda:InvokedViaFunctionUrl": "true"
        }
      }
    }
  ]
}
```

Function URL requests must be signed with AWS Signature Version 4. Postman and
recent `curl` builds support SigV4 signing. A healthy run returns HTTP 200. If any
configured endpoint fails, the probe returns HTTP 503 with bounded status and
latency details.

## Cleanup

Delete only this stack:

```sh
sam delete --stack-name YOUR_STACK_NAME --region us-east-2
```

That removes the function, Function URL, execution role, and one-day log group.
No existing site resource is imported into or deleted by this stack.

## AWS references

- [SAM Function URL configuration](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-functionurlconfig.html)
- [Lambda Function URL IAM authorization](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html)
- [Lambda Function URL pricing](https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html#furls-http-invoke-decision-cost)
- [Lambda Free Tier pricing](https://aws.amazon.com/lambda/pricing/)
