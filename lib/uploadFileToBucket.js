'use strict';
const pify = require('pify');
const path = require('path');
const fs = pify(require('fs'));
const magic = new (require('mmmagic').Magic)();

module.exports = {
    async uploadFileToBucket(filePath, Bucket) {

        const [ Body, ContentType ] = await Promise.all([
            fs.readFile(filePath),
            getMimeType(filePath)
        ]);

        const Key = filePath.replace(this.clientPath, '').substr(1).replace('\\', '/');

        this.log(`uploading ${ Key }`);
        await this.s3Request('putObject', { Bucket, Body, ContentType, Key });
    }
};

function getMimeType(filePath) {
    return new Promise(
        (res, rej) => magic.detectFile(filePath, (err, data) => err ? rej(err) : res(data))
    );
}
