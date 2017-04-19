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
            'before:deploy:createDeploymentArtifacts': () => this.mergeApigS3Resources()
        };
    }

    async initDeploy() {
        const Utils = this.serverless.utils;
        const Error = this.serverless.classes.Error;

        const dist = _.get(this.serverless, 'service.custom.apigs3.dist', 'dist');

        if (!Utils.dirExistsSync(path.join(this.serverless.config.servicePath, 'client', dist))) {
            throw new Error(`Could not find "client/${ dist } folder in your project root.`);
        }

        this.bucketName = this.serverless.service.resources.Outputs;
        this.clientPath = path.join(this.serverless.config.servicePath, 'client', dist);
    }

    async mergeApigS3Resources() {

        const ownResources = await this.yamlParser.parse(
            path.resolve(__dirname, 'resources.yml')
        );

        _.merge(
            this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
            ownResources
        );
    }

    async deploy() {
        this.log('Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...');

        const buckets = await this.s3Request('listBuckets');

        const bucket = _.find(buckets, { Name: this.bucketName });
        if (!bucket) {
            throw new Error(`Bucket "${ this.bucketName }" not found! Re-deploy`);
        }

        await this.purgeBucket(bucket);
        await this.uploadFolderToBucket(this.clientPath, bucket);
    }

    async purgeBucket(Bucket) {
        const params = { Bucket };

        const { Contents } = await this.s3Request('listObjectsV2', params);
        const Objects = Contents.map(({ Key }) => ({ Key }));

        params.Delete = { Objects };
        await this.s3Request('deleteObjects', params);
    }


    async uploadFolderToBucket(folder, bucket) {
        const fileList = fs.readDirSync(folder);

        // use fs.stat to determine if folder or file.
        // if folder, recursively call self.
    }

    async uploadFileToBucket(filePath, Bucket) {

        const [ Body, ContentType ] = Promise.all([
            fs.readFileAsync(filePath),
            mime.lookup(filePath)
        ]);

        const Key = filePath.replace(_this.clientPath, '').substr(1).replace('\\', '/');

        await this.s3Request('putObject', { Bucket, Body, ContentType, Key });
    }

    s3Request(fn, params = {}) {
        return this.aws.request('S3', fn, params, this.stage, this.region);
    }
}

module.exports = ServerlessApigS3;
