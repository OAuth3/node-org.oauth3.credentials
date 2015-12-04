'use strict';

module.exports.create = function (app, config, routes) {
  return function (rest) {
    rest.post(config.routes.accounts.create, routes.create);
    rest.get(config.routes.accounts.get, routes.get);
    //rest.post(config.apiPrefix + config.routes.accounts.create, routes.create);
    //rest.get(config.apiPrefix + config.routes.accounts.get, routes.get);
/*
    rest.get('/:accountId/me', requireLdsAccount, LdsConnect.restful.profile);
    //rest.get('/me', requireLdsAccount, LdsConnect.restful.profile);

    // TODO require verified account
    rest.get('/:accountId/debug/raw', requireLdsAccount, requireDevelopmentToken, LdsConnect.restful.getRaw);

    rest.post('/:accountId/verify/code', requireLdsAccount, Verifier.restful.getClaimCode);
    rest.post('/:accountId/verify/code/validate', requireLdsAccount, LdsConnect.restful.validateClaimCode);

    rest.post('/:accountId/mark-as-checked', requireLdsAccount, LdsConnect.restful.markAsChecked);
*/
  };
};
