'use strict';
const { merge } = require('lodash');
const { get } = require('lodash');
const { map } = require('lodash');
const { cloneDeep } = require('lodash');
const pify = require('pify');
const fs = pify(require('fs'));
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

        this.stackName = serverless.service.service;

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
            'before:package:createDeploymentArtifacts': () => { this.updatePopulatedMembers(); this.mergeApigS3Resources(); },
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

    updateIamRoleAndPolicyNames(roleResource) {
        roleResource[ "Properties" ][ "RoleName" ] = this.stackName + "_" + roleResource[ "Properties" ][ "RoleName" ] + "_" + this.options.stage;
        roleResource[ "Properties" ][ "Policies" ][ 0 ][ "PolicyName" ] = this.stackName + "_" + roleResource[ "Properties" ][ "Policies" ][ 0 ][ "PolicyName" ] + "_" + this.options.stage;
        return roleResource
    }

    updatePopulatedMembers() {
        const options = this.serverless.processedInput.options;
        // defined in index.js:22
        this.stackName = this.serverless.service.service;
        // defined in lib/ServerlessAWSPlugin.js:10
        this.stage = options.stage || get(this.serverless, 'service.provider.stage');
        // defined in lib/ServerlessAWSPlugin.js:11
        this.region = options.region || get(this.serverless, 'service.provider.region');
    }

    async mergeApigS3Resources() {
        const oldCwd = process.cwd();
        const ownResources = await this.serverless.yamlParser.parse(
            path.resolve(__dirname, 'resources.yml')
        );

        process.chdir(oldCwd);

        const withIndex = get(this.serverless, 'service.custom.apigs3.withIndex', true);
        if(!withIndex) {
            delete ownResources['Resources']['ApiGatewayMethodIndexGet'];
            delete ownResources['Resources']['ApiGatewayMethodDefaultRouteGet'];
            delete ownResources['Resources']['ApiGatewayResourceDefaultRoute'];
        }

        const topFiles = get(this.serverless, 'service.custom.apigs3.topFiles', false);
        if(topFiles) {
            this.getDistFolder();

            const dirContents = map(await fs.readdir(this.clientPath),
                name => path.join(this.clientPath, name)
            );

            const dotFiles = get(this.serverless, 'service.custom.apigs3.dotFiles', false);

            await Promise.all(dirContents.map(async item => {
                const stat = await fs.stat(item);
                if (!stat.isFile()) return;

                const pathPart = path.basename(item);
                if (pathPart === 'index.html' || (pathPart[0] === '.' && !dotFiles)) return;

                const routeName = this.aws.naming.getResourceLogicalId(pathPart);
                const routeId = this.aws.naming.extractResourceId(routeName);
                const route = cloneDeep(ownResources['Resources']['ApiGatewayResourceAssets']);

                route['Properties']['PathPart'] = pathPart;
                ownResources['Resources'][routeName] = route;

                const methodName = this.aws.naming.getMethodLogicalId(routeId, 'Get');
                const method = cloneDeep(ownResources['Resources']['ApiGatewayMethodDefaultRouteGet']);

                method['Properties']['Integration']['Uri']['Fn::Join'][1].splice(4, 1, '/' + pathPart);
                method['Properties']['ResourceId']['Ref'] = routeName;
                ownResources['Resources'][methodName] = method;
            }));
        }

        const resourceName = get(this.serverless, 'service.custom.apigs3.resourceName', 'assets');
        ownResources['Resources']['ApiGatewayResourceAssets']['Properties']['PathPart'] = resourceName;

        const resourcePath = get(this.serverless, 'service.custom.apigs3.resourcePath', '');
        if (resourcePath) {
          const method = ownResources['Resources']['ApiGatewayMethodAssetsItemGet'];
          method['Properties']['Integration']['Uri']['Fn::Join'][1].splice(4, 0, resourcePath);
        }

        const existing = this.serverless.service.provider.compiledCloudFormationTemplate;

        ownResources[ "Resources" ][ "IamRoleApiGatewayS3" ] = this.updateIamRoleAndPolicyNames(ownResources[ "Resources" ][ "IamRoleApiGatewayS3" ], this.stage);

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
