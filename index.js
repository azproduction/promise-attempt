module.exports = process.env.PROMISE_ATTEMPT_COVERAGE ?
    require('./lib-cov') :
    require('./lib');
