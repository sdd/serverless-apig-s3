'use strict';
const _ = require('lodash');
const pify = require('pify');
const path = require('path');
const fs = pify(require('fs'));
const magic = new (require('mmmagic').Magic)();

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

            'client:deploy:deploy': async () => {
                await this.initDeploy();
                return this.deploy();
            }
        };
    }

    async initDeploy() {
        const Utils = this.serverless.utils;
        const Error = this.serverless.classes.Error;

        const dist = _.get(this.serverless, 'service.custom.apigs3.dist', 'client/dist');

        if (!Utils.dirExistsSync(path.join(this.serverless.config.servicePath, dist))) {
            throw new Error(`Could not find "client/${ dist } folder in your project root.`);
        }

        const StackName = this.aws.naming.getStackName(this.options.stage);

        const { Stacks } = await this.aws.request(
            'CloudFormation',
            'describeStacks',
            { StackName },
            this.options.stage,
            this.options.region
        );

        const { Outputs } = _.find(Stacks, { StackName });
        const { OutputValue } = _.find(Outputs, { OutputKey: 'S3BucketFrontEndName' });

        this.log('Target Bucket: ' + JSON.stringify(OutputValue, null, 2));

        this.bucketName = OutputValue;
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

        const { Buckets } = await this.s3Request('listBuckets');

        const bucket = _.find(Buckets, { Name: this.bucketName }).Name;
        if (!bucket) {
            throw new Error(`Bucket "${ this.bucketName }" not found! Re-deploy`);
        }

        await this.purgeBucket(bucket);
        await this.uploadFolderToBucket(this.clientPath, bucket);

        this.log('Deployment complete.');
    }

    async purgeBucket(Bucket) {
        const params = { Bucket };
        const { Contents } = await this.s3Request('listObjectsV2', params);

        if (!Contents.length) { return; }
        const Objects = Contents.map(({ Key }) => ({ Key }));

        params.Delete = { Objects };
        await this.s3Request('deleteObjects', params);
    }

    async uploadFolderToBucket(folder, bucket) {
        const dirContents = _.map(await fs.readdir(folder),
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

        const [ Body, ContentType ] = await Promise.all([
            fs.readFile(filePath),
            getMimeType(filePath)
        ]);

        const Key = filePath.replace(this.clientPath, '').substr(1).replace('\\', '/');

        this.log(`uploading ${ Key }`);
        await this.s3Request('putObject', { Bucket, Body, ContentType, Key });
    }

    s3Request(fn, params = {}) {
        return this.aws.request('S3', fn, params, this.stage, this.region);
    }
}

module.exports = ServerlessApigS3;

function getMimeType(filePath) {
    return new Promise(
        (res, rej) => magic.detectFile(filePath, (err, data) => err ? rej(err) : res(data))
    );
}
