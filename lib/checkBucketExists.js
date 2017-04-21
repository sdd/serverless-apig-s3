'use strict';
const { find } = require('lodash');

module.exports = {
    async checkBucketExists () {
        const { Buckets } = await this.s3Request('listBuckets');

        const bucket = find(Buckets, { Name: this.bucketName }).Name;
        if (!bucket) {
            throw new Error(`Bucket "${ this.bucketName }" not found! Re-run sls deploy`);
        }
    }
};
