'use strict';
const { merge } = require('lodash');
const { get } = require('lodash');
const path = require('path');
const ServerlessAWSPlugin = require('./lib/ServerlessAWSPlugin');
const checkBucketExists = require('./lib/checkBucketExists');
const getBucketName = require('./lib/getBucketName');
const getDistFolder = require('./lib/getDistFolder');
const purgeBucket = require('./lib/purgeBucket');
const uploadFileToBucket = require('./lib/uploadFileToBucket');
const uploadFolderToBucket = require('./lib/uploadFolderToBucket');

module.exports = class ServerlessApigS3 extends ServerlessAWSPlugin {

    constructor(serverless, options) {
        super(serverless, options);

        this.commands = {
            client: {
                usage: 'Deploy client code',
                lifecycleEvents:[ 'client', 'deploy' ],
                commands: {
                    deploy: {
                        usage: 'Deploy serverless client code',
                        lifecycleEvents:[ 'deploy' ]
                    }
                }
            }
        };

        this.hooks = {
            'before:deploy:createDeploymentArtifacts': () => this.mergeApigS3Resources(),
            'client:client': () => { this.serverless.cli.log(this.commands.client.usage); },
            'client:deploy:deploy': () => this.deploy()
        };

        Object.assign(this,
            checkBucketExists,
            getBucketName,
            getDistFolder,
            purgeBucket,
            uploadFileToBucket,
            uploadFolderToBucket
        );
    }

    async mergeApigS3Resources() {
        const ownResources = await this.serverless.yamlParser.parse(
            path.resolve(__dirname, 'resources.yml')
        );

        const withIndex = get(this.serverless, 'service.custom.apigs3.withIndex', true);
        if(!withIndex) {
            delete ownResources['Resources']['ApiGatewayMethodIndexGet'];
            delete ownResources['Resources']['ApiGatewayMethodDefaultRouteGet'];
            delete ownResources['Resources']['ApiGatewayResourceDefaultRoute'];
        }

        const resourceName = get(this.serverless, 'service.custom.apigs3.resourceName', 'assets');
        ownResources['Resources']['ApiGatewayResourceAssets']['Properties']['PathPart'] = resourceName;

        const resourcePath = get(this.serverless, 'service.custom.apigs3.resourcePath', '');
        if (resourcePath) {
          const method = ownResources['Resources']['ApiGatewayMethodAssetsItemGet'];
          method['Properties']['Integration']['Uri']['Fn::Join'][1].splice(4, 0, resourcePath);
        }

        const existing = this.serverless.service.provider.compiledCloudFormationTemplate;

        merge(existing, ownResources);
    }

    async deploy() {
        this.getDistFolder();
        await this.getBucketName();

        await this.checkBucketExists();
        this.log('Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...');

        this.log('emptying current bucket contents...');
        await this.purgeBucket(this.bucketName);

        this.log('uploading content...');
        await this.uploadFolderToBucket(this.clientPath, this.bucketName);
        this.log('Deployment complete.');
    }
};
