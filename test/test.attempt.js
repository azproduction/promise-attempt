var vow = require('vow'),
    chai = require('chai'),
    expect = chai.expect,
    Attempt = require('..'),
    attempt = Attempt;

function configure() {
    Attempt.configure(function () {
        return vow.promise();
    });
}

describe('attempt', function () {
    it('attempt.then() should throw an exception if attempt is not configured', function () {
        expect(function () {
            attempt(function () {
                return vow.fulfill(true);
            }).then(function () {});
        }).to.throw(Error);
    });
});

describe('attempt', function () {
    beforeEach(configure);

    it('can be constructed via new operator', function () {
        expect(new Attempt(vow.fulfill)).to.have.property('then');
    });

    it('can be constructed via call', function () {
        expect(attempt(vow.fulfill)).to.have.property('then');
    });

    it('should reject by default', function (done) {
        attempt(vow.reject).then(function () {
            done('fail');
        }, done);
    });

    it('should pass error and attemptNo to promiseGenerator', function (done) {
        var test1 = attempt(function (error, attemptNo) {
            try {
                expect(arguments.length).to.equal(2);
                expect(error).to.be.a('null');
                expect(attemptNo).to.equal(0);
            } catch (e) {
                done(e);
                return;
            }
            return vow.fulfill(false);
        });

        var test2 = attempt(function (error, attemptNo) {
            try {
                expect(arguments.length).to.equal(2);

                if (!attemptNo) {
                    expect(error).to.be.a('null');
                    expect(attemptNo).to.equal(0);

                    return vow.reject(false);
                }

                expect(error).to.equal(false);
                expect(attemptNo).to.equal(1);
            } catch (e) {
                done(e);
                return;
            }
            return vow.fulfill(false);
        }, function () {
            return true;
        });

        vow.all([test1, test2]).then(function () {
            done();
        }, done);
    });

    it('should pass error, attemptNo, and decision callback to decisionGenerator', function (done) {
        attempt(function (error, attemptNo) {
            if (!attemptNo) {
                return vow.reject(false);
            }

            return vow.fulfill(false);
        }, function (error, attemptNo, decision) {
            try {
                expect(arguments.length).to.equal(3);
                expect(error).to.equal(false);
                expect(attemptNo).to.equal(1);
                expect(decision).to.be.a('function');
            } catch (e) {
                done(e);
                return;
            }

            return true;
        }).then(function () {
            done();
        }, done);
    });

    it('should notify promise with error and currentAttempt', function (done) {
        attempt(
            function (error, attemptNo) {
                if (!attemptNo) {
                    return vow.reject(false);
                }

                return vow.fulfill(false);
            },
            function () {
                return true;
            })
            .then(
            function () {},
            function () {},
            function (args) {
                try {
                    expect(arguments.length).to.equal(1);
                    expect(args.length).to.equal(2);
                    expect(args[0]).to.equal(false);
                    expect(args[1]).to.equal(1);
                } catch (e) {
                    done(e);
                    return;
                }
                done();
            });
    });

    it('should reject if null, false or Infinity was returned from decisionGenerator', function (done) {
        function returns(value) {
            return function () {
                return value;
            };
        }

        function rejectsWithFalse() {
            return vow.reject(false);
        }

        var promises = [
            attempt(rejectsWithFalse, returns(null)),
            attempt(rejectsWithFalse, returns(false)),
            attempt(rejectsWithFalse, returns(Infinity))
        ];

        vow.allResolved(promises).then(function (values) {
            var result = values.every(function (promise) {
                return promise.isRejected();
            });

            try {
                expect(result).to.equal(true);
            } catch (e) {
                done(e);
                return;
            }
            done();
        });
    });

    it('should reject if null, false, undefined or Infinity was passed to decision callback', function (done) {
        function decides(value) {
            return function (error, attemptNo, decide) {
                decide(value);
            };
        }

        function rejectsWithFalse() {
            return vow.reject(false);
        }

        var promises = [
            attempt(rejectsWithFalse, decides(null)),
            attempt(rejectsWithFalse, decides(false)),
            attempt(rejectsWithFalse, decides(Infinity)),
            attempt(rejectsWithFalse, decides(void 0))
        ];

        vow.allResolved(promises).then(function (values) {
            var result = values.every(function (promise) {
                return promise.isRejected();
            });

            try {
                expect(result).to.equal(true);
            } catch (e) {
                done(e);
                return;
            }
            done();
        });
    });

    it('should follow promise from decisionGenerator', function (done) {
        function rejectsWithFalse() {
            return vow.reject(false);
        }

        function alwaysRejects() {
            return rejectsWithFalse();
        }

        var test1 = attempt(rejectsWithFalse, alwaysRejects)
            .then(function () {}, function () {
                return true;
            });

        function resolvesOnSecondAttempt(error, attemptNo) {
            if (!attemptNo) {
                return vow.reject(false);
            }

            return vow.fulfill(true);
        }

        function alwaysResolves() {
            return vow.resolve(true);
        }

        var test2 = attempt(resolvesOnSecondAttempt, alwaysResolves);

        vow.all([test1, test2]).then(function () {
            done();
        }, done);
    });

    it('should skip second decision', function (done) {
        function rejectsWithFalse() {
            return vow.reject(false);
        }

        function decisionGenerator(error, attemptNo, decide) {
            decide(false);
            decide(true);
        }

        attempt(rejectsWithFalse, decisionGenerator)
            .then(function () {
                done('fail');
            }, function () {
                done();
            });
    });

    it('if decision is a Number it should repeat request in N milliseconds', function (done) {
        function resolvesOnSecondAttempt(error, attemptNo) {
            if (!attemptNo) {
                return vow.reject(false);
            }

            return vow.fulfill(true);
        }


        function decisionGenerator() {
            return 50;
        }

        var time = Date.now();
        attempt(resolvesOnSecondAttempt, decisionGenerator)
            .then(function () {
                try {
                    expect(Date.now()).to.be.at.least(time + 50);
                } catch (e) {
                    done(e);
                    return;
                }
                done();
            }, function () {
                done('fail');
            });
    });

    it('should reject if decisionGenerator throws', function (done) {
        attempt(function (error) {
            return vow.reject(error);
        }, function () {
            throw new Error();
        }).then(function () {
            done('fail');
        }, function () {
            done();
        });
    });

    it('should call promise.resolve if promise.fulfill is undefined', function (done) {
        attempt.configure(function () {
            var promise = vow.promise();
            promise.resolve = promise.fulfill;
            promise.fulfill = void 0;
            return promise;
        });

        attempt(function () {
                return vow.fulfill();
            })
            .then(function () {
                done();
            }, function () {
                done('fail');
            });
    });
});
