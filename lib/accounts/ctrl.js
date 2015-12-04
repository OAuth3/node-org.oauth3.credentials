'use strict';

var PromiseA = require('bluebird').Promise;

module.exports.create = function (config, Db, jwsUtils) {
  var hashsum = require('secret-utils').hashsum;
  function weakCipher(secret, val) {
    return require('../common').weakCipher(val, secret);
  }
  function weakDecipher(secret, val) {
    return require('../common').weakDecipher(val, secret);
  }

  var Accounts = {};

  Accounts.publish = function (client, account) {
    var pub;

    console.log('[publish]', account);
    pub = account.public || {};
    pub.appScopedId = weakCipher(client.secret, account.id);

    return pub;
  };

  Accounts.getJointId = function (account, login) {
    console.log('[getJointId]');
    console.log(account.id, login.id, hashsum('sha1', account.id + ':' + login.id));
    return hashsum('sha1', account.id + ':' + login.id);
  };

  /*
    createWithLogins

    validate that the logins are signed
    create a new account
    attach the logins to the new account
    if the logins do not have a primary (default) account, set it to the new login
  */
  Accounts.createWithLogins = function (client, requestedLogins, newAccount) {
    return PromiseA.all(requestedLogins.map(function (login) {
      return jwsUtils.verifyJwt(login.token, { error: true }).then(function (token) {
        // TODO by api key?
        if (client.id !== token.app) {
          return PromiseA.reject({
            message: "[Developer Error] Tokens are authorized, but the clients mismatch. "
              + "If you feel there is a valid use case for this, please create an issue on github."
          , code: "E_MISMATCH_CLIENT"
          });
        }

        login.data = token;
        login.id = login.hashId = weakDecipher(client.secret, token.idx);
      });
    })).then(function (/*tokens*/) {
      newAccount.id = require('node-uuid').v4();
      newAccount.totpEnabledAt = (newAccount.totpEnabledAt || newAccount.totp) && (new Date().toISOString()) || null;

      return Db.Accounts.create(newAccount.id, newAccount).then(function () {
        console.log('account', newAccount);
        return PromiseA.all(requestedLogins.map(function (login) {
          // Idempotent on upsert as well
          return Db.AccountsLogins.create(Accounts.getJointId(newAccount, login), { accountId: newAccount.id, loginId: login.id });
        })).then(function () {
          return PromiseA.all(requestedLogins.map(function (login) {
            // TODO XXX use logins controller? LoginsCtrl.unsafeGet
            return Db.Logins.get(login.id).then(function (login) {
              if (!login.primaryAccountId) {
                // Any mutation *will* lead to data corruption,
                // but pick your battles. This is easy to recover.
                login.primaryAccountId = newAccount.id;
                return Db.Logins.save(login);
              }
            });
          }));
        });
      });
    }).then(function () {
      return newAccount;
    });
  };

  // trusting that the implementer has paired the logins
  Accounts.dangerousAttachLogins = function (config, account, authorizedRequests) {
    if (!account) {
      return PromiseA.reject(new Error("[SANITY FAIL] no account was given to link to"));
    }

    var ps = [];
    // TODO maybe do this in reverse? So that it ends up in the session?
    // logins.forEach.related('accounts').attach(account)
    /*
    return $account.related('logins').attach(requestedLogins.map(function (login) {
      return login.id;
    }))
    */
    authorizedRequests.forEach(function (login) {
      // hash(accounts.id, login.id)
      ps.push(Db.AccountsLogins.upsert({
        id: hashsum('sha1', account.id + ':' + login.id)
      , accountId: account.id
      , loginId: login.id || login.hashId
      }));
    });

    return PromiseA.all(ps).then(function (logins) {
      //
      // return the result
      //
      var ps = [];

      logins.forEach(function (login) {
        if (!login.primaryAccountId) {
          login.primaryAccountId = account.id;
          ps.push(Db.Logins.save(login));
        }
      });

      return PromiseA.all(ps);
    });
  };

  Accounts.attachLogins = function (config, account, authorizedLogins, requestedLogins) {
    return Accounts.lintLogins(config, authorizedLogins, requestedLogins).then(function (authorizedRequests) {
      return Accounts.dangerousAttachLogins(config, account, authorizedRequests);
    });
  };

  Accounts.create = function (config, newAccount, opts) {
    var uuid = opts && opts.id || require('node-uuid').v4();

    newAccount.id = uuid;

    return Db.Accounts.create(newAccount).then(function () {
      return newAccount;
    });
  };


  // handles the creation of an account and linking it to existing accounts
  Accounts.oldCreateWithLogins = function (config, newAccount, authorizedLogins, requestedLogins) {
    //
    // check that the account doesn't violate basic constraints
    //
    if (newAccount.id || newAccount.uuid || newAccount._id) {
      return PromiseA.reject({
        message: 'You may not supply your own account id when creating an account', code: 400
      });
    }

    if (newAccount.role) {
      return PromiseA.reject({
        message: 'You may not supply your own role when creating an account', code: 400
      });
    }
//attachLogins

    return Accounts.lintLogins(config, authorizedLogins, requestedLogins).then(function (authorizedRequests) {
      // TODO middleware hook goes here
      // TODO remove, this is ldsaccount specific
      var ldslogin;
      var ldslogins = authorizedRequests.filter(function (login) {
        return 'local' === login.type || 'localaccount' === login.type;
      });
      var profile;
      var me;

      if (ldslogins.length < 1) {
        return PromiseA.reject("You must have an LDS Account to create an account at this time.");
      }
      if (ldslogins.length > 1) {
        return PromiseA.reject("You may only link one LDS Account per account at this time.");
      }

      ldslogin = ldslogins[0];
      if (0 !== ldslogin.related('accounts').length) {
        return PromiseA.reject("You may only create one account per LDS Account at this time.");
      }

      newAccount.token = ldslogin.token;
      newAccount.jar = ldslogin.jar;
      newAccount.lastSessionAt = ldslogin.lastSessionAt;
      profile = (ldslogin.profile || {});
      me = (profile.me || {});
      // TODO sync up on every manual login
      // (and on occasion just for fun)
      newAccount.public = {
        individualId: me.individualId || me.id
      /*
      , homeId: me.homeId
      , phones: me.phones
      , emails: me.emails
      , name: me.name
      , givennames: me.givennames
      , surnames: me.surnames
      , homeWardId: 
      , homeStakeId: 
      , callings: profile.callings
      , callingWards: profile.wards
      , stakeStakes: profile.stakes
      */
      };
      return Accounts.create(config, newAccount, { manualId: ldslogins[0].id }).then(function (account) {
        // NOTE: we lint before creating the account and then attach directly after creating it
        return Accounts.dangerousAttachLogins(config, account, authorizedRequests).then(function (/*jointables*/) {
          return account;
        });
      });
    });
  };

  return Accounts;
};
