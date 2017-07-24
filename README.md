# serverless-apig-s3

This Serverless plugin automates the process of both configuring AWS to serve static front-end
content and deploying your client-side bundle.

It creates an S3 bucket to hold your front-end content, and adds two routes to API Gateway:

 * `GET / => bucket/index.html`
 * `GET /assets/* => bucket/*`

This allows your API and front-end assets to be served from the same domain, sidestepping
any CORS issues. CloudFront is also not used. The combination of these two properties
makes this plugin a good fit for a dev stage environment.

### Installation

```bash
npm i -D serverless-apig-s3
```

This plugin requires node > 7.6 because fuck callbacks.

### Configuration

serverless.yml:

```yaml
plugins:
 - serverless-apig-s3

custom:
  apigs3:
    dist: client/dist    # path within service to find content to upload (default: client/dist)
    dotFiles: true       # include files beginning with a dot in resources and uploads (default: false)
    topFiles: true       # create routes for top-level files in dist folder (default: false)
    resourceName: static # route path for static assets (default: assets)
    resourcePath: /dist  # path prefix for assets in s3 bucket (default: '')
```

### Usage

```bash
sls deploy    # ensure that sls deploy has been run so that this plugin's resources exist.
sls client deploy    # uploads client build artifacts to s3
```

Something missing? More documentation? All Issues / PRs welcome at https://github.com/sdd/serverless-apig-s3
