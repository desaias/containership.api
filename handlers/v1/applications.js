'use strict';

const _has = require('lodash.has');
const _includes = require('lodash.includes');
const _isUndefined = require('lodash.isundefined');
const _keys = require('lodash.keys');
const _last = require('lodash.last');
const _map = require('lodash.map');
const async = require('async');

module.exports = {

    // get applications
    get(req, res, next) {
        const core = req.core;
        res.stash = {
            body: {},
            code: 200
        };

        return core.cluster.myriad.persistence.keys(core.constants.myriad.APPLICATIONS, (err, applications) => {
            if(err) {
                res.stash.code = 500;
                return next();
            }

            return async.each(applications, (application_name, fn) => {
                return core.cluster.myriad.persistence.get(application_name, (err, application) => {
                    if(err) {
                        res.stash.code = 500;
                        return fn();
                    }

                    try {
                        application = JSON.parse(application);
                        return core.applications.get_containers(application.id, (err, containers) => {
                            if(err) {
                                res.stash.code = 500;
                                return fn();
                            }

                            application.containers = containers;
                            res.stash.body[application.id] = application;
                            return fn();
                        });
                    } catch(err) {
                        res.stash.code = 500;
                        return fn();
                    }
                });
            }, next);
        });
    },

    // create applications
    create(req, res, next) {
        const core = req.core;
        if(!_isUndefined(req.body)) {
            let all_applications = null;

            return async.series([
                (fn) => {
                    return core.cluster.myriad.persistence.keys(core.constants.myriad.APPLICATIONS, (err, applications) => {
                        if(err) {
                            return fn();
                        }

                        applications = _map(applications, (application) => {
                            return _last(application.split(core.constants.myriad.DELIMITER));
                        });

                        all_applications = applications;

                        if(_has(req.query, 'destroy') && req.query.destroy == 'true') {
                            all_applications = [];
                            return async.each(applications, (application_name, fn) => {
                                core.applications.remove(application_name, fn);
                            }, fn);
                        } else {
                            return fn();
                        }
                    });
                },
                (fn) => {
                    return async.each(_keys(req.body), (application_name, fn) => {
                        if(!_includes(all_applications, application_name)) {
                            return core.applications.add(req.body[application_name], fn);
                        }

                        return fn();
                    }, fn);
                }
            ], () => {
                res.stash.code = 201;
                return next();
            });
        }

        res.stash.code = 400;
        return next();
    }

};
