'use strict';
const _ = require('lodash');
const pify = require('pify');
const path = require('path');
const fs = pify(require('fs'));
const mmm = pify((new (require('mmmagic').Magic)).detectFile);

class ServerlessApigS3 {

    constructor(serverless, options) {

        this.serverless = serverless;
        this.options = options;

        this.provider = 'aws';
        this.stage = 'dev';
        this.region = 'eu-west-2';
        this.aws = this.serverless.getProvider(this.provider);

        this.log = serverless.cli.log.bind(serverless.cli);
        this.yamlParser = serverless.yamlParser;

        this.commands = {
            client: {
                usage: 'Generate and deploy clients',
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
            'client:client': () => {
                this.serverless.cli.log(this.commands.client.usage);
            },

            'client:deploy:deploy': () => {
                this.initDeploy();
                return this.deploy();
            }
        };
    }

    initDeploy() {
        const Utils = this.serverless.utils;
        const Error = this.serverless.classes.Error;

        const dist = _.get(this.serverless, 'service.custom.apigs3.dist', 'client/dist');

        if (!Utils.dirExistsSync(path.join(this.serverless.config.servicePath, dist))) {
            throw new Error(`Could not find "client/${ dist } folder in your project root.`);
        }

        console.log(this.serverless.service.provider);

        this.bucketName = 'auth-dev-s3bucketfrontend-16f8dufo06c45'; //this.serverless.service.provider.compiledCloudFormationTemplate
            //.Outputs.S3BucketFrontEndName.Value;
        this.clientPath = path.join(this.serverless.config.servicePath, dist);
    }

    async mergeApigS3Resources() {

        const ownResources = await this.yamlParser.parse(
            path.resolve(__dirname, 'resources.yml')
        );

        _.merge(
            this.serverless.service.provider.compiledCloudFormationTemplate,
            ownResources
        );
    }

    async deploy() {
        this.log('Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...');

        const buckets = await this.s3Request('listBuckets');

        console.log(JSON.stringify(buckets));

        const bucket = _.find(buckets.Buckets, { Name: this.bucketName }).Name;
        if (!bucket) {
            throw new Error(`Bucket "${ this.bucketName }" not found! Re-deploy`);
        }

        await this.purgeBucket(bucket);
        await this.uploadFolderToBucket(this.clientPath, bucket);
    }

    async purgeBucket(Bucket) {
        const params = { Bucket };

        console.log('purge: ', params);

        const { Contents } = await this.s3Request('listObjectsV2', params);

        console.log('objects: ', Contents);

        const Objects = Contents.map(({ Key }) => ({ Key }));

        if (!Objects.length) { return; }

        params.Delete = { Objects };

        console.log('delete: ', params);

        await this.s3Request('deleteObjects', params);
    }

    async uploadFolderToBucket(folder, bucket) {
        const dirContents = _.map(
            await fs.readdir(folder),
            name => path.join(folder, name)
        );

        await Promise.all(dirContents.map(async item => {

            const stat = await fs.stat(item);

            if (stat.isFile()) {
                return this.uploadFileToBucket(item, bucket);

            } else if (stat.isDirectory()) {
                return this.uploadFolderToBucket(item, bucket);
            }
        }));
    }

    async uploadFileToBucket(filePath, Bucket) {

        const [ Body, ContentType ] = Promise.all([
            fs.readFile(filePath),
            mmm(filePath)
        ]);

        const Key = filePath.replace(this.clientPath, '').substr(1).replace('\\', '/');

        const params = { Bucket, Body, ContentType, Key };

        console.log('putObject: ', params);

        await this.s3Request('putObject', params);
    }

    s3Request(fn, params = {}) {
        return this.aws.request('S3', fn, params, this.stage, this.region);
    }
}

module.exports = ServerlessApigS3;
