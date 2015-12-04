'use strict';

module.exports.create = function (app, config, models) {
  var urlrouter = require('urlrouter');
  var connectRestful;
  var jwsUtils;

  //
  // Requires login, but not account
  //
  app
    .lazyMatch(config.apiPrefix, '/accounts', function () {
      if (!connectRestful) {
        connectRestful = urlrouter(require('./lib/accounts').create(app, config, models, jwsUtils));
      }
      return connectRestful;
    });
  app
    .lazyApi('/accounts', function () {
      if (!connectRestful) {
        connectRestful = urlrouter(require('./lib/accounts').create(app, config, models, jwsUtils));
      }
      return connectRestful;
    });

  return app;
};
