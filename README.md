# serverless-apig-s3

This Serverless plugin automates the process of both configuring AWS to serve static front-end
content and deploying your client-side bundle.

It creates an S3 bucket to hold your front-end content, and adds two routes to API Gateway:

 * GET / => bucket/index.html
 * GET /assets/* => bucket/*

This allows your API and front-end assets to be served from the same domain, sidestepping
any CORS issues. CloudFront is also not used. The combination of these two properties
makes this plugin a good fit for a dev stage environment.

### Installation

```bash
npm i -D serverless-apig-s3
```

### Configuration

serverless.yml:

```yaml
plugins:
 - serverless-apig-s3

custom:
  apigs3:
    dist: client/dist    # path within service to find content to upload (default: client/dist
```


### Options:

There are none! Seriously though, if you need any, just raise a PR or an Issue.

Something missing? More documentation? All PRs welcome at https://github.com/sdd/serverless-dynalite
