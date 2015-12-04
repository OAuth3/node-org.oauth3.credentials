'use strict';

//var PromiseA = require('bluebird').Promise;
var cipher = require('../common').cipher;
//var decipher = require('./common').decipher;
var never = '1970-01-01T00:00:00.000Z'; // new Date(0).toISOString();

module.exports.create = function (app, config, AccountsCtrl) {
  return {
    get: function (req, res) {
      var promise = req.oauth3.getAccounts().then(function (_accounts) {
        return req.oauth3.getClient().then(function (client) {
          var accounts = _accounts.map(function (account) {
            //var appScopedId;
            var result;
            var pub = account.public || {};

            console.log('account');
            console.log(account);
            //appScopedId = cipher(account.id, client.secret);

            result = {
                appScopedId: cipher(account.id, client.secret)
              , emailVerifiedAt: pub.emailVerifiedAt || never
              , phoneVerifiedAt: pub.phoneVerifiedAt || never
              , userVerifiedAt: pub.userVerifiedAt || never
              , hasEmail: !!pub.email
              , hasPhone: !!pub.phone
            };

            return result;
          });

          return { accounts: accounts };
        });
      });

      return app.handlePromise(req, res, promise, "get accounts (in ldsconnect.js)");
    }
  , create: function (req, res) {
      var newAccount = req.body.account;
      var requestedLogins = req.body.logins || [];
      var promise;


      promise = req.oauth3.getClient(req.oauth3.token).then(function (client) {
        console.log('[create][getClient] client', client);
        return AccountsCtrl.createWithLogins(client, requestedLogins, newAccount).then(function (account) {
          account = AccountsCtrl.publish(client, account);

          account.checkedAt = account.checkedAt || never;

          return account;
        });
      }).then(function (account) {
        res.send(account);
      }, function (err) {
        console.error('[createWithLogins]');
        console.error(err.stack);
        res.send({
          error: { 
            message: err && err.message || 'invalid logins or accounts'
          , code: err && err.code
          }
        });
      });

      return app.handleRejection(req, res, promise, 'Accounts.restful.create');
    }
  };
};
