'use strict';

const _has = require('lodash.has');
const _isUndefined = require('lodash.isundefined');
const _keyBy = require('lodash.keyby');
const async = require('async');

module.exports = {
    // get host
    get(req, res, next) {
        const core = req.core;
        const hosts = _keyBy(core.cluster.legiond.get_peers(), 'id');

        const attributes = core.cluster.legiond.get_attributes();
        hosts[attributes.id] = attributes;

        const host = hosts[req.params.host];
        if(_isUndefined(host)) {
            return next();
        }
        host.containers = [];

        return core.cluster.myriad.persistence.keys([core.constants.myriad.CONTAINERS_PREFIX, '*', '*'].join(core.constants.myriad.DELIMITER), (err, containers) => {
            if(err) {
                res.stash.code = 500;
                return next();
            }

            return async.each(containers, (container_name, fn) => {
                return core.cluster.myriad.persistence.get(container_name, (err, container) => {
                    if(err) {
                        return fn();
                    }

                    try {
                        container = JSON.parse(container);
                        if(container.host == host.id) {
                            container.application = container_name.split(core.constants.myriad.DELIMITER)[2];
                            host.containers.push(container);
                        }
                    } catch(err) { /* do nothing */ }
                    return fn();
                });
            }, () => {
                res.stash.code = 200;
                res.stash.body = host;
                return next();
            });
        });
    },

        // update host
    update(req, res, next) {
        const core = req.core;
        if(!_isUndefined(req.body) && _has(req.body, 'tags')) {
            const hosts = _keyBy(core.cluster.legiond.get_peers(), 'id');

            const attributes = core.cluster.legiond.get_attributes();
            hosts[attributes.id] = attributes;

            const host = hosts[req.params.host];

            if(!_isUndefined(host)) {
                core.cluster.legiond.send({
                    event: core.constants.events.UPDATE_HOST,
                    data: req.body.tags
                }, host);

                res.stash.code = 200;
            }
        } else {
            res.stash.code = 400;
        }

        return next();
    },

    // delete host
    delete(req, res, next) {
        const core = req.core;
        const hosts = _keyBy(core.cluster.legiond.get_peers(), 'id');

        const attributes = core.cluster.legiond.get_attributes();
        hosts[attributes.id] = attributes;

        const host = hosts[req.params.host];

        if(!_isUndefined(host)) {
            core.cluster.legiond.send({
                event: core.constants.events.DELETE_HOST
            }, host);

            res.stash.code = 204;
        }

        return next();
    }

};
