
oath 1.0 component for chrome extension, using [ohauth](https://github.com/tmcw/ohauth)

Handles the user authorization stage by opening a new tab, and then closing it. It does it by redirecting to a local callback-page.html after the user authorization, then the extension closes the tab and resumes the oauth process.

```js
// We need to specify where the component is relative to the root
// so the extension can find callback-page.html
var OAuth = require('chrome-oauth')('components/tomerdmnt-chrome-oauth/');

// OAuth options
var opts = {
  "requestTokenUrl": "https://api.dropbox.com/1/oauth/request_token",
  "authorizeUrl": "https://www.dropbox.com/1/oauth/authorize",
  "accessTokenUrl": "https://api.dropbox.com/1/oauth/access_token",
  "consumerKey": "your_consumer_key",
  "consumerSecret": "your_cosumer_secret"
};

// All steps of the authorization with this line
OAuth.authorize(opts, function (err, o) {
  if (err) throw new Error(err);
  // prepare a request object
  var req = {
    url: 'http://...'
    method: 'POST',
    data: {data: 'data'},
    qs: {a: 'b'},
    headers: {
      'Content-Type': 'application/json'
    }
  };
  // send a request
  o.send(req, function (xhr) { 
    // do something
  });

  // it also works with a regular parmeters
  // o.send('GET', 'http://..', qs, data, headers, cb);
});
```

## Installation

```bash
  $ component install tomerdmnt/oauth
```

## API

Check out index.js

