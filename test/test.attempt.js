/* jshint expr:true */
var vm = require('vm'),
    fs = require('fs'),
    vow = require('vow'),
    sinon = require('sinon'),
    chai = require('chai').use(require('sinon-chai')),
    expect = chai.expect;

var attemptSrc = require.resolve(process.env.PROMISE_ATTEMPT_COVERAGE ? '../lib-cov' : '../lib'),
    attemptCode = fs.readFileSync(attemptSrc, 'utf8');

var Attempt,
    attempt;

function clean() {
    try {
        delete require.cache[require.resolve('..')];
        delete require.cache[attemptSrc];
    } catch (e) {}
}

function reset() {
    Attempt = require('..');
    attempt = Attempt;
}

function configure() {
    Attempt.configure(vow.Promise);
}

describe('attempt export', function () {
    beforeEach(function () {
        clean();
    });

    it('attempt should be exported in commonjs environment', function () {
        expect(require('..')).to.be.a('function');
    });

    it('attempt should be exported in AMD environment', function () {
        var define = sinon.spy();
        define.amd = {};

        var newGlobal = {
            global: {
                __coverage__: global.__coverage__
            },
            define: define
        };

        vm.runInNewContext(attemptCode, newGlobal);

        expect(define).to.have.been.calledOnce;
        expect(define).to.have.been.calledWithMatch(sinon.match.func);
    });

    it('attempt should be exported in browser or worker environment', function () {
        var newGlobal = {
            global: {
                __coverage__: global.__coverage__
            }
        };

        vm.runInNewContext(attemptCode, newGlobal);

        expect(newGlobal.attempt).to.be.a('function');
    });
});

describe('attempt.configure()', function () {
    beforeEach(function () {
        clean();
        reset();
    });

    afterEach(function () {
        delete global.Promise;
    });

    it('attempt.then() should throw an exception if attempt is not configured', function () {
        expect(function () {
            attempt(function () {
                return vow.fulfill(true);
            }).then(function () {});
        }).to.throw(Error);
    });

    it('attempt.then() should not throw an exception if global Promise exists', function () {
        global.Promise = vow.Promise;
        clean();
        reset();

        attempt(function () {
            return vow.fulfill(true);
        }).then(function () {});
    });

    it('ignores missing `progress` callback', function (done) {
        Attempt.configure(function (handler) {
            return new vow.Promise(function (resolve, reject) {
                handler(resolve, reject);
            });
        });

        attempt(function (error, attemptNo) {
                return vow.fulfill(!!attemptNo);
            }, function () {
                return true;
            })
            .then(function () {
                done();
            }, function () {
                done(Error('onRejected should not be called'));
            }, function () {
                done(Error('onProgressed should not be called'));
            });
    });
});

describe('attempt()', function () {
    beforeEach(function () {
        clean();
        reset();
        configure();
    });

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
            return 10;
        }

        var time = Date.now();
        attempt(resolvesOnSecondAttempt, decisionGenerator)
            .then(function () {
                try {
                    expect(Date.now()).to.be.at.least(time + 10);
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

});
