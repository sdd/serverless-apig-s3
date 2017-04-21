'use strict';
const { get } = require('lodash');

module.exports = class ServerlessAWSPlugin {

    constructor(serverless, options) {

        Object.assign(this, { serverless, options });

        this.stage = options.stage || get(serverless, 'service.provider.stage');
        this.region = options.region || get(serverless, 'service.provider.region');

        this.provider = 'aws';
        this.aws = this.serverless.getProvider(this.provider);

        this.log = serverless.cli.log.bind(serverless.cli);
    }

    s3Request(fn, params = {}) {
        return this.aws.request('S3', fn, params, this.stage, this.region);
    }
};
