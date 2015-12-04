'use strict';

var PromiseA = require('bluebird');

module.exports.create = function (conf, deps, app) {

  return deps.systemSqlFactory.create({
    init: true
  , dbname: 'org.oauth3.profiles'
  }).then(function (Db) {

    var wrap = require('masterquest-sqlite3');
    var directive = [
      //
      // Accounts
      //
      { tablename: 'accounts'
      , idname: 'id' // crypto random id? or hash(name) ?
      , unique: ['name']
      , indices: ['createdAt', 'updatedAt', 'deletedAt', 'name', 'displayName']
      }
    , { tablename: 'accounts_logins'
      , idname: 'id' // hash(accountId + loginId)
      , indices: ['createdAt', 'revokedAt', 'loginId', 'accountId']
      }
    ];

    return wrap.wrap(Db, directive).then(function (models) {

      return PromiseA.resolve(require('./express-oauth3-credentials').create(app, {
        apiPrefix: '/api/org.oauth3.credentials'
      }, models));

    });
  });
};
