'use strict';
const { find } = require('lodash');

module.exports = {
    async getBucketName() {
        const StackName = this.aws.naming.getStackName(this.options.stage);

        const { Stacks } = await this.aws.request(
            'CloudFormation',
            'describeStacks',
            { StackName },
            this.options.stage,
            this.options.region
        );
        const { Outputs } = find(Stacks, { StackName });
        const { OutputValue } = find(Outputs, { OutputKey: 'S3BucketFrontEndName' });

        this.log('Target Bucket: ' + JSON.stringify(OutputValue, null, 2));
        this.bucketName = OutputValue;
    }
};
