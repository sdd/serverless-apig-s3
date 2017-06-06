'use strict';
const pify = require('pify');
const path = require('path');
const fs = pify(require('fs'));
const mimeLookup = require('mime-types').lookup;

const ACL = "public-read";

module.exports = {
    async uploadFileToBucket(filePath, Bucket) {

        const Body = await fs.readFile(filePath);
        const ContentType = mimeLookup(filePath).toString();

        const Key = filePath.replace(this.clientPath, '').substr(1).replace('\\', '/');

        this.log(`uploading ${ Key } with MIME type ${ ContentType }`);
        await this.s3Request('putObject', { ACL, Bucket, Body, ContentType, Key });
    }
};
