'use strict';

const _last = require('lodash.last');
const async = require('async');

module.exports = {
    // get all variables
    get(req, res, next) {
        const core = req.core;
        const vars = {};

        return core.cluster.myriad.persistence.keys(core.constants.myriad.VARIABLES, (err, variables) => {
            if(err) {
                res.stash.code = 500;
                return next();
            }

            return async.each(variables, (variable_name, fn) => {
                return core.cluster.myriad.persistence.get(variable_name, (err, value) => {
                    if(err) {
                        return fn(err);
                    }
                    variable_name = _last(variable_name.split(core.constants.myriad.DELIMITER));
                    vars[variable_name] = value;

                    return fn();
                });
            }, (err) => {
                if(err) {
                    res.stash.code = 500;
                    return next();
                }

                res.stash.code = 200;
                res.stash.body = vars;
                return next();
            });
        });
    }
};
