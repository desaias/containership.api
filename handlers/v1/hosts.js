'use strict';

const _each = require('lodash._each');
const _keyBy = require('lodash._keyby');
const async = require('async');

module.exports = {
    // get all hosts
    get(req, res, next) {
        const core = req.core;
        const hosts = _keyBy(core.cluster.legiond.get_peers(), 'id');
        const attributes = core.cluster.legiond.get_attributes();
        hosts[attributes.id] = attributes;

        _each(hosts, (configuration/*, host*/) => {
            configuration.containers = [];
        });

        return core.cluster.myriad.persistence.keys(core.constants.myriad.APPLICATIONS, (err, applications) => {
            if(err) {
                res.stash.code = 500;
                return next();
            }

            return async.each(applications, (application_name, fn) => {
                // eslint thinks configuration isn't used since it's in a try/catch
                // eslint-disable-next-line no-unused-vars
                return core.cluster.myriad.persistence.get(application_name, (err, configuration) => {
                    if(err) {
                        return fn(err);
                    }

                    try {
                        configuration = JSON.parse(configuration);
                    } catch(err) {
                        return fn(err);
                    }

                    return fn();
                });
            }, (err) => {
                if(err) {
                    res.stash.code = 500;
                    return next();
                }

                return core.cluster.myriad.persistence.keys([core.constants.myriad.CONTAINERS_PREFIX, '*', '*'].join(core.constants.myriad.DELIMITER), (err, containers) => {
                    if(err) {
                        res.stash.code = 500;
                        return next();
                    }

                    return async.each(containers, (container_name, fn) => {
                        return core.cluster.myriad.persistence.get(container_name, (err, container) => {
                            if(err) {
                                return fn(err);
                            }

                            try {
                                container = JSON.parse(container);
                                const application = container_name.split(core.constants.myriad.DELIMITER)[2];
                                container.application = application;
                                hosts[container.host].containers.push(container);
                            } catch(err) {
                                return fn(err);
                            }
                            return fn();
                        });
                    }, (err) => {
                        if(err) {
                            res.stash.code = 500;
                            return next();
                        }

                        res.stash.code = 200;
                        res.stash.body = hosts;

                        return next();
                    });
                });
            });
        });
    }

};
