'use strict';

var sinon = require('sinon');
var Promise = require('bluebird');
var assert = require('assert');

module.exports = function() {
  describe('websocket-transport', function() {

    it('should connect', function() {
      return this.websocket.connect();
    });

    it('should cancel connect', function() {
      var connect = this.websocket.connect();

      return Promise.delay(1)
        .bind(this)
        .then(function() {
          assert(connect.isPending());
          connect.cancel();
        })
        .delay(1)
        .then(function() {
          assert(connect.isCancelled());
          assert(!connect._socket);
        });
    });

    it('should notify on close', function() {
      var mock = sinon.mock(this.dispatcher);
      mock.expects("transportDown").once();

      return this.websocket.connect()
        .bind(this)
        .then(function() {
          this.websocket.close();
          mock.verify();
        });
    });

  });
};
