'use strict';

var Transport = require('../transport');
var inherits  = require('inherits');
var extend    = require('lodash/object/extend');

function NodeLocalTransport(dispatcher, endpoint) {
  NodeLocalTransport.super_.call(this, dispatcher, endpoint);
}
inherits(NodeLocalTransport, Transport);

extend(NodeLocalTransport.prototype, {
  request: function(messages) {
    var self = this;
    this.endpoint.process(messages, null, function(replies) {
      self._receive(replies);
    });
  }
});

/* Statics */
NodeLocalTransport.isUsable = function(client, endpoint, callback) {
  /* TODO: come up with a better way of knowing that the endpoint is the Faye Server */
  callback(!!endpoint.process);
};

module.exports = NodeLocalTransport;