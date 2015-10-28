'use strict';

var Promise = require('bluebird');
var debug   = require('debug-proxy')('faye:envelope');

/**
 * An envelope wraps a single message that the client is
 * attempting to send to the server
 */
function Envelope(message, scheduler, options) {
  var self = this;

  this.message = message;       // Message to send
  this._scheduler = scheduler;  // Scheduler
  this._timeout = null;         // Retry/interval timeout
  this._request = null;         // Outstanding request

  this.promise = new Promise(function(resolve, reject) {
      self._resolve = resolve;
      self._reject = reject;
    })
    .cancellable()
    .then(function(result) {
      // Mark as success
      self._scheduler.succeed();
      self._request = null;
      return result;
    });

  // Absolute timeout for message send
  if (options && options.deadline) {
    this.promise = this.promise
      .timeout(options.deadline, 'Deadline timeout on envelope');
  }

  // Add some cleanup code
  this.promise = this.promise.finally(function() {
      /* If the request is still pending, cancel it */
      self._abortRequest();
      if (self._timeout) clearTimeout(self._timeout);
    });

}

Envelope.prototype = {

  /**
   * Called when the dispatcher is about to
   * send the message to the transport.
   * Returns true if it should be sent
   */
  scheduleSend: function(onSend, onTimeout) {
    // If we're waiting to retry, or the request is in-flight, return false
    if (this._timeout || this._request) return false;
    var scheduler = this._scheduler;
    var self = this;

    scheduler.send();

    // Check if the message is still deliverable
    if (!scheduler.isDeliverable()) {
      debug('Message no longer deliverable, rejecting: %j', self.message);
      this.reject(new Error('Delivery failed'));
      return false;
    }
    this._timeout = setTimeout(function() {
      debug('Send timeout period exceeded');
      self._timeout = null;
      onTimeout();
    }, scheduler.getTimeout());

    scheduler.send();

    // On send needs to return the request object
    this._request = onSend();
  },

  failScheduleRetry: function(onRetry) {
    var self = this;
    var scheduler = this._scheduler;

    scheduler.fail();

    this._abortRequest();

    // Is there a request timeout or a retry timeout?
    // Cancel it
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    // If the message is no longer deliverable,
    // cancel it immediately
    if (!scheduler.isDeliverable()) {
      debug('Message no longer deliverable after failure, rejecting: %j', self.message);
      this.reject(new Error('Message is no longer deliverable'));
      return;
    }

    // Schedule a timer for when to retry
    this._timeout = setTimeout(function() {
      self._timeout = null;
      onRetry();
    }, scheduler.getInterval());

  },

  /**
   * If there is an in-flight request for this message, cancel it
   */
  _abortRequest: function() {
    var request = this._request;
    if (!request) return;
    this._request = null;

    // Is there an in-flight request?
    // Cancel it
    try {
      request.abort();
    } catch(e) {
      debug('abort failed: %s', e);
    }
  },

  /**
   * In the event that we are unable to communicate with the server
   */
  reject: function(e) {
    this._scheduler.abort();
    this._reject(e);
  },

  /**
   * Called by the dispatcher when a response is succesfully
   * receieved
   */
  resolve: function(reply) {
    this._resolve(reply);
  },



};

module.exports = Envelope;