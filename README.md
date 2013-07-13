# promise-attempt [![NPM version](https://badge.fury.io/js/promise-attempt.png)](https://npmjs.org/package/promise-attempt) [![Build Status](https://travis-ci.org/azproduction/promise-attempt.png?branch=master)](https://travis-ci.org/azproduction/promise-attempt) [![Coverage Status](https://coveralls.io/repos/azproduction/promise-attempt/badge.png?branch=master)](https://coveralls.io/r/azproduction/promise-attempt)

Attempt tries to resolve promises.

For example attempt can try to get valuable data from server over unstable mobile networks. Or can handle some unexpected
network lags with 0 code.

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
    // 404 - no reason to continue
    if (err.status === 404) return false || null || void 0;

    // To many attempts, net totally down
    if (attemptNo > 5) {
        return false;
    }

    return attemptNo * 2000;
})
.then(resolve, reject, progress);

function resolve(data) {
    yourStuff(data);
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
