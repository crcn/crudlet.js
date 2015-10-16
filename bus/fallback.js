var Bus = require('./base');
var Response = require('../response');

/**
 */

function FallbackBus(busses) {
  this._busses = busses;
}

/**
 */

 Bus.extend(FallbackBus, {

  /**
   */

  execute: function(operation) {
    return Response.create((writable) => {
      var busses = this._busses.concat();
      var next = (i) => {
        if (i === busses.length) return writable.end();
        var response = busses[i].execute(operation);
        var hasChunk = false;
        response.pipeTo({
          write: function(value) {
            hasChunk = true;
            writable.write(value);
          },
          end: function() {
            if (hasChunk) {
              writable.end();
            } else {
              next(i + 1);
            }
          },
          abort: writable.abort.bind(writable)
        });
      };
      next(0);
    });
  }
});

/**
 */

module.exports =  FallbackBus;
