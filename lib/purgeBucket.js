'use strict';

module.exports = {
    async purgeBucket(Bucket) {
        const params = { Bucket };
        const { Contents } = await this.s3Request('listObjectsV2', params);

        if (!Contents.length) { return; }
        const Objects = Contents.map(({ Key }) => ({ Key }));

        params.Delete = { Objects };
        await this.s3Request('deleteObjects', params);
    }
};
