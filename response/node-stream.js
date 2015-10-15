var AsyncResponse = require('./async');
var extend = require('../internal/extend');

/**
 */

function NodeStreamResponse(stream) {

  AsyncResponse.call(this, (writable) => {

    if (!stream) return writable.end();

    var pump = () => {
      stream.resume();
      stream.once('data', function(data) {
        stream.pause();
        writable.write(data).then(pump);
      });
    }

    var end = () => {
      writable.end();
    }

    stream
    .once('end', end)
    .once('error', writable.abort.bind(writable));

    pump();
  });
}

/**
 */

extend(AsyncResponse, NodeStreamResponse);

/**
 */

module.exports =  NodeStreamResponse;