/**
 *
 * @return {Object}
 */
var promise = function () {
    return {
        then: function () {
            throw new Error('Attempt.configure() before use Attempt');
        }
    };
};

/**
 * Default decision
 */
var noop = function () {};

/**
 * It tries to resolve promise
 *
 * @example
 *
 * new Attempt(function () {
 *    return $.getJSON('/json');
 *
 * }, function (err, attemptNo) {
 *    if (err.status < 500) return;
 *
 *    return attemptNo * 2000;
 * })
 * .then(function (data) {
 *     yourStuff(data);
 *
 * }, function (error) {
 *     console.log('I tried several times... and fail :(', error);
 *
 * }, function (error, attemptNo) {
 *     console.log('Failed to load, retrying...', error, attemptNo);
 *
 * });
 *
 * @param {Function} promiseGenerator    (error, attemptNo): Promise                 promise generator
 * @param {Function} [decisionGenerator] (error, attemptNo, decide): Number|Boolean  decision generator
 *
 * @return {Promise}
 */
function Attempt(promiseGenerator, decisionGenerator) {
    if (!(this instanceof Attempt)) {
        return new Attempt(promiseGenerator, decisionGenerator);
    }
    this.promise = promise();

    this.isResolved = false;
    this.promiseGenerator = promiseGenerator;
    this.decisionGenerator = decisionGenerator || noop;
    this.currentAttemptNumber = 0;
    this.error = null;

    this._attempt();

    return this.promise;
}

/**
 * Defines promise generator
 * @param {Function} promiseGenerator
 */
Attempt.configure = function (promiseGenerator) {
    promise = promiseGenerator;
};

Attempt.prototype = {
    _attempt: function() {
        var self = this,
            promise = self.promise;

        if (self.isResolved) {
            return;
        }

        self.promiseGenerator(self.error, self.currentAttemptNumber)
        .then(function (data) {
            if (self.isResolved) {
                return;
            }

            self.isResolved = true;
            // for jQuery...
            (promise.fulfill || promise.resolve).call(promise, data);

        }, function (error) {
            if (self.isResolved) {
                return;
            }

            self.error = error;
            self.currentAttemptNumber++;

            var decide = self.createDecide(),
                timeout = self.decisionGenerator(self.error, self.currentAttemptNumber, decide);

            if (typeof timeout !== "undefined") {
                decide(timeout);
            }
        });
    },

    /**
     * It rejects promise if timeout is Infinity or undefined or false or null
     * It follows promise comes from decision of it rejectes Attempt will reject also
     * If it is Number - then timeout will be set
     *
     * @param {Number|Boolean|Promise} [timeout]
     * @private
     */
    _decide: function (timeout) {
        // bad response
        if (timeout === Infinity || typeof timeout === "undefined" || timeout === false || timeout === null) {
            self.isResolved = true;
            promise.reject(this.error);
            return;
        }

        // this is Promise
        if (typeof timeout.then === "function") {
            this._followPromise(timeout);
            return;
        }

        promise.notify(this.error, self.currentAttemptNumber);
        setTimeout(function () {
            self._attempt();
        }, timeout);
    },

    /**
     * It follows promise that comes from desicion
     *
     * @param {Promise} promise
     * @private
     */
    _followPromise: function (promise) {
        var self = this;

        promise.then(function (timeout) {
            self._decide(timeout);
        }, function () {
            self._decide();
        });
    },

    /**
     * Create decide that acts once
     *
     * @return {Function}
     */
    createDecide: function () {
        var self = this,
            called = false;

        /**
         * Call once per rejection
         */
        return function (decision) {
            if (called) {
                return;
            }
            called = true;
            return self._decide.call(self, decision);
        };
    }
};

module.exports = Attempt;
