'use strict';
const { get } = require('lodash');
const path = require('path');

module.exports = {
    getDistFolder() {
        const Utils = this.serverless.utils;
        const Error = this.serverless.classes.Error;

        const dist = get(this.serverless, 'service.custom.apigs3.dist', 'client/dist');

        if (!Utils.dirExistsSync(path.join(this.serverless.config.servicePath, dist))) {
            throw new Error(`Could not find "${ dist }" folder in your service root.`);
        }
        this.clientPath = path.join(this.serverless.config.servicePath, dist);
    }
};
