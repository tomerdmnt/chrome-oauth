var oh = require('./ohauth');
var seq = require('./seq');

module.exports = function(cbpagedir) {
  // Set the chrome callback page
  cbpagedir = cbpagedir || 'components/tomerdmnt-chrome-oauth/';
  if (cbpagedir[cbpagedir.length-1] !== '/') cbpagedir += '/';
  OAuth.cbpage = cbpagedir + 'callback-page.html';
  return OAuth;
}
module.exports.dropbox = require('./dropbox');

/**
 * Start OAuth flow, creates an OAuth instance
 * calls the callback function with
 * the OAuth instance to make signed requests with
 * @param  {Object}   opts                  OAuth infomation
 * @param  {String}   opts.consumerKey      OAuth Consumer Key
 * @param  {String}   opts.consumerSecret   OAuth Consumer Secret
 * @param  {String}   opts.requestTokenUrl  Request Token Url
 * @param  {String}   opts.authorizeUrl     Request Token Url
 * @param  {String}   opts.accessTokenUrl   Request Token Url
 * @param  {Object}   oauthOpts             OAuth additional attributes
 * @param  {Function} cb                    Callback Function
 */
OAuth.authorize = function (opts, oauthOpts, cb) {
  if (!cb) {
    cb = oauthOpts;
    oauthOpts = null;
  }

  var oauth = OAuth(opts, oauthOpts);
  oauth.authorize(function (err) {
    cb.call(oauth, err, oauth);
  });
};

OAuth.fromConfig = function (conf) {
  var oauth = OAuth({});

  oauth.o = conf.o;
  oauth.consumerSecret = conf.consumerSecret;
  oauth.tokenSecret = conf.tokenSecret;

  return oauth;
};

function OAuth(opts, oauthOpts) {
  if (!(this instanceof OAuth)) return new OAuth(opts, oauthOpts);
  var self = this;
  self.o = {
    oauth_consumer_key: opts.consumerKey,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_version: '1.0'
  };
  self.consumerSecret = opts.consumerSecret;
  self.tokenSecret = '';

  if (oauthOpts) {
    Object.keys(oauthOpts).forEach(function (k) {
      self.o[k] = oauthOpts[k];
    });
  }

  self.toConfig = function () {
    return {
      o: self.o,
      consumerSecret: self.consumerSecret,
      tokenSecret: self.tokenSecret
    };
  };


  /**
   * Start OAuth flow
   * @param  {Function} cb Callback Function
   */
  self.authorize = function (cb) {
    seq(getRequestToken,
      userAuthorize,
      getAccessToken,
      cb);
  };

  /**
   * Send Oauth 1.0 Signed Requests
   * Usage:
   *   send('POST', 'https://api.example.com', {'a':'b'}, {data:'data'}, cb);
   *   send({ method: 'POST', url: 'https://api.example.com',
   *          qs: {'a':'b'}, {data:'data'}}, cb);
   * @param  {String}   method 'POST'/'GET'
   * @param  {String}   url    url for the api call
   * @param  {Object}   qs     query string parameters object [optional]
   * @param  {Object}   data   the object [optional]
   * @param  {Function} cb     Callback function with xhr argument
   */
  self.send = function (method, url, qs, data, headers, cb) {
    // Parameters handling
    if (typeof method === 'object') {
      qs = method.qs;
      data = method.data;
      headers = method.headers;
      cb = url;
      url = method.url;
      method = method.method;
    }
    if (typeof qs === 'function') {
      cb = qs;
      qs = null;
    } else if (typeof data === 'function') {
      cb = data;
      data = null;
    } else if (typeof headers === 'function') {
      cb = headers;
      headers = null;
    }

    // oauth header
    self.o.oauth_timestamp = oh.timestamp();
    self.o.oauth_nonce = oh.nonce();

    // prepare for the oauth signature
    var sigParams = {};
    Object.keys(self.o).forEach(function (k) {
      sigParams[k] = self.o[k];
    });

    if (qs) {
      Object.keys(qs).forEach(function (k) {
        sigParams[k] = qs[k];
      });
    }

    self.o.oauth_signature = oh.signature(self.consumerSecret, self.tokenSecret,
                                oh.baseString(method, url, sigParams));

    if (qs) {
      var params = oh.qsString(qs);
      if (params && params !== '')
        url += '?' + params;
    }

    oh.xhr(method, url, self.o, data, { header: headers }, cb);
  };

  function handleTokenResponse(xhr) {
    var resp = oh.stringQs(xhr.responseText);
    self.tokenSecret = resp.oauth_token_secret;
    self.o.oauth_token = resp.oauth_token;
  }

  /**
   * First step of OAuth flow, get request tokens
   * @param  {Function} cb Callback function
   */
  function getRequestToken(cb) {
    self.send('POST', opts.requestTokenUrl, null, null, function (xhr) {
      // check status codes
      if (xhr.status !== 200 && xhr.status !== 201) {
        var resp = JSON.parse(xhr.responseText);
        return cb(new Error(resp.error));
      }

      handleTokenResponse(xhr);
      cb(null);
    });
  }

  /**
   * Second step of OAuth flow, manual user authorization
   * @param  {Function} cb Callback function
   */
  function userAuthorize(err, cb) {
    if (err) return cb(err);
    var qs = {
      oauth_token: self.o.oauth_token,
      oauth_callback: chrome.extension.getURL(OAuth.cbpage)
    };
    var url = opts.authorizeUrl + '?' + oh.qsString(qs);

    chrome.tabs.create({ url: url }, function (tab) {
      // Listen to messages from the callback page
      chrome.extension.onMessage.addListener(onMessage.bind(self, tab));
    });

    function onMessage(tab, request, sender) {
      if (request.type === "callback-page" &&
        sender.tab.id === tab.id) {
        // resume the authentication
        chrome.tabs.remove(sender.tab.id);
        cb(null);
        // clean up listener
        chrome.extension.onMessage.removeListener(onMessage);
      }
    }
  }

  /**
   * Third and last step of OAuth flow
   * Fetching the user spefic access token
   * @param  {Function} cb Callback function
   */
  function getAccessToken(err, cb) {
    if (err) return cb(err);
    self.send('POST', opts.accessTokenUrl, null, null, function(xhr) {
      // check status codes
      if (xhr.status !== 200 && xhr.status !== 201) {
        var resp = JSON.parse(xhr.responseText);
        return cb(new Error(resp.error));
      }

      handleTokenResponse(xhr);
      cb(null);
    });
  }
}
