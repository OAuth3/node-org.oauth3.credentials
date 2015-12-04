'use strict';

var Accounts = module.exports = {
  Ctrl: require('./ctrl')
, Routes: require('./routes')
, Router: require('./router')
, create: function (app, config, Db, jwsUtils) {

    var ctrl = Accounts.Ctrl.create(config, Db, jwsUtils);
    var routes = Accounts.Routes.create(app, config, ctrl);

    config.routes = config.routes || {};
    config.routes.accounts = {
      create: '/accounts'
    , get: '/accounts'
    };

    return Accounts.Router.create(app, config, routes);
  }
};
