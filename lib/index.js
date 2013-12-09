/* global define: true */
(function (root, factory) {
    'use strict';
    if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else {
        // Browser globals
        root.attempt = factory();
    }
})
(this, function () {
    'use strict';

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
    var noop = function () {
        return false;
    };

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

            self.promiseGenerator(self.error, self.currentAttemptNumber)
                .then(function (data) {
                    // for jQuery...
                    (promise.fulfill || promise.resolve).call(promise, data);
                },
                function (error) {
                    self.error = error;
                    self.currentAttemptNumber++;

                    var decide = self.createDecide(),
                        decision = false;

                    try {
                        decision = self.decisionGenerator(self.error, self.currentAttemptNumber, decide);
                    } catch(e) {}

                    if (typeof decision !== 'undefined') {
                        decide(decision);
                    }
                });
        },

        /**
         * It rejects promise if timeout is Infinity or undefined or false or null
         * It follows promise comes from decision of it rejectes Attempt will reject also
         * If it is Number - then timeout will be set
         *
         * @param {Number|Boolean|Promise} [decision]
         * @private
         */
        _decide: function (decision) {
            var self = this;

            // bad response
            if (decision === Infinity || typeof decision === 'undefined' || decision === false || decision === null) {
                this.promise.reject(this.error);
                return;
            }

            // this is Promise
            if (typeof decision.then === 'function') {
                this._followPromise(decision);
                return;
            }

            this.promise.notify([this.error, this.currentAttemptNumber]);
            setTimeout(function () {
                self._attempt();
            }, decision);
        },

        /**
         * It follows promise that comes from desicion
         *
         * @param {Promise} promise
         * @private
         */
        _followPromise: function (promise) {
            var self = this;

            promise.then(function (decision) {
                self._decide(decision);
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

    return Attempt;
});
