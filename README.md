# promise-attempt [![NPM version](https://badge.fury.io/js/promise-attempt.png)](https://npmjs.org/package/promise-attempt) [![Build Status](https://travis-ci.org/azproduction/promise-attempt.png?branch=master)](https://travis-ci.org/azproduction/promise-attempt) [![Coverage Status](https://coveralls.io/repos/azproduction/promise-attempt/badge.png?branch=master)](https://coveralls.io/r/azproduction/promise-attempt)

Attempt tries to resolve promises.

 - Can try to get valuable data from server over unstable mobile networks. 
 - Can handle some unexpected network lags with 0 code or timeouts.

For example, user of your service have some critical data and you want to deliver it to your server.
User browsing under unstable and slow cellular network. You may give up on first fail or try to fix this problem,
using callback hell or use this solution :)

Assume you have rule which defines behaviour of repeating requests:
 - each next repeat should be performed in `N * 500ms`, where N is attempt number
 - `error.status >= 500` - no reason to repeat, your server totally down
 - `error.status === 400` - no reason to repeat, something wrong with input data
 - `error.status === 0` (aka abort) - repeat
 - if number of repeats is more than 5 - ask user continue to repeat or not
 - if number of repeats is more than 10 - do not repeat

And instead of calling promise directly
```js
$.getJSON('/json')
.then(resolve, reject, progress);
```

wrap it with 
```js
new Attempt(function () {
    return $.getJSON('/json');
},
function repeatRules(err, attemptNo) {
    // no reason to repeat
    if (err && (err.status === 400 || err.status >= 500)) {
        return false;
    }
    
    // if number of repeats is more than 10 - do not repeat
    if (attemptNo > 10) {
        return false;
    }
    
    // if number of repeats is more than 5 - ask user what repeat or not
    if (attemptNo > 5) {
        return askUserWhatToDo().pipe(function () {
             return attemptNo * 500;
        });
    }
    
    // each next repeat should be performed in N * 500ms
    return attemptNo * 500;
})
.then(resolve, reject, progress);
```
[Live example](http://jsfiddle.net/j8bSF/) 

## Examples

### Configure attempt

```js
attempt.configure(function () {
    return $.Deferred() || require('vow').promise();
});
```

### Synchronous example

```js
attempt(function promiseFactory() {
   return $.getJSON('/json');
},
function decision(err, attemptNo) {
    // if not timeout (null)
    // and 0 < status < 500 - no reason to continue
    if (err && err.status > 0 && err.status < 500) {
        return false || null || void 0;
    }

    // To many attempts - network or server totally down
    if (attemptNo > 5) {
        return false;
    }

    // repeat request in N * 2000 ms
    return attemptNo * 2000;
})
.then(resolve, reject, progress);

function resolve(data) {
    return processData(data);
}

function reject(error) {
    console.log('I tried several times... and fail :(', error);
}

function progress(error, attemptNo) {
    console.log('Failed to load, retrying...', error, attemptNo);
}
```

### Async example

```js
attempt(function () {
   return $.getJSON('/json');
},
function (err, attemptNo, decide) {
   setTimeout(function () {
       decide(Math.random() > 0.5 ? true : false);
   }, 1000)
})
.then(resolve, reject, progress);
```

### Promise example

```js
attempt(function () {
   return $.getJSON('/json');
},
function (err, attemptNo) {
   // askUserWhatToDo - a Promise factory
   return askUserWhatToDo(err, attemptNo);
})
.then(resolve, reject, progress);
```

### Attempt number in promise Factory function

```js
attempt(function (err, attemptNo) {
    // pass attempt to server (for logging)
    return $.getJSON('/json?attempt=' + attemptNo);
},
function (err, attemptNo) {
   // askUserWhatToDo - a Promise factory
   return askUserWhatToDo(err, attemptNo);
})
.then(resolve, reject, progress);
```
