'use strict';
const _ = require('lodash');
const path = require('path');

class ServerlessApigS3 {

    constructor(serverless, options) {

        this.serverless = serverless;
        this.options = options;

        this.log = serverless.cli.log.bind(serverless.cli);
        this.yamlParser = serverless.yamlParser;

        this.commands = {};

        this.hooks = {
            'before:deploy:createDeploymentArtifacts': this.mergeApigS3Resources.bind(this),
        };
    }

    async mergeApigS3Resources() {

        const ownResources = await this.yamlParser.parse(
            path.resolve(__dirname, 'resources.yml')
        );

        _.merge(
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            ownResources
        );

        return Promise.resolve();
    }
}

module.exports = ServerlessApigS3;
